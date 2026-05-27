import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildControlRoomSnapshot } from "../apps/control-room/src/dashboard.js";
import { evaluatePhase1Run } from "../packages/evaluation/src/index.js";
import { containsSensitiveFields, createLiveDataGateway, normalizeLiveEvent } from "../services/live-data-gateway/src/index.js";
import { compileActionGraph } from "../services/action-compiler/src/index.js";
import { createDecisionPlan } from "../services/agent-orchestrator/src/index.js";
import { createAuditLedger, recordPhase1Run } from "../services/audit-ledger/src/index.js";
import { assembleDecisionContext } from "../services/context-assembly/src/index.js";
import { createEventIngress } from "../services/event-ingress/src/index.js";
import { executeActionGraph } from "../services/execution-os/src/index.js";
import { evaluatePolicies } from "../services/policy-service/src/index.js";

test("phase 1 pipeline executes a safe checkout offer", async () => {
  const event = await loadCheckoutEvent();
  const ingress = createEventIngress();

  const ingested = ingress.ingestCheckoutEvent(event);
  const { request, context } = assembleDecisionContext(ingested);
  const policyResult = evaluatePolicies(request, context);
  const plan = createDecisionPlan(request, context, policyResult);
  const actionGraph = compileActionGraph(plan);
  const receipt = await executeActionGraph(actionGraph);

  assert.equal(ingested.status, "accepted");
  assert.equal(policyResult.decision, "allow");
  assert.equal(actionGraph.approval_status, "not_required");
  assert.equal(receipt.status, "completed");
  assert.equal(receipt.actions.length, 1);
});

test("duplicate checkout events are detected by ingress", async () => {
  const event = await loadCheckoutEvent();
  const ingress = createEventIngress();

  assert.equal(ingress.ingestCheckoutEvent(event).status, "accepted");
  assert.equal(ingress.ingestCheckoutEvent(event).status, "duplicate");
});

test("high fraud risk routes to a blocking fraud action", async () => {
  const event = await loadCheckoutEvent();
  const ingress = createEventIngress();
  const ingested = ingress.ingestCheckoutEvent(event);
  const { request, context } = assembleDecisionContext(ingested, {
    fraud_risk_score: 0.91
  });
  const policyResult = evaluatePolicies(request, context);
  const plan = createDecisionPlan(request, context, policyResult);
  const actionGraph = compileActionGraph(plan);
  const receipt = await executeActionGraph(actionGraph);

  assert.equal(policyResult.decision, "block");
  assert.equal(actionGraph.actions[0].type, "FRAUD_CREATE_CASE");
  assert.equal(receipt.status, "completed");
});

test("medium fraud risk produces an approval-gated action graph", async () => {
  const event = await loadCheckoutEvent();
  const ingress = createEventIngress();
  const ingested = ingress.ingestCheckoutEvent(event);
  const { request, context } = assembleDecisionContext(ingested, {
    fraud_risk_score: 0.55
  });
  const policyResult = evaluatePolicies(request, context);
  const plan = createDecisionPlan(request, context, policyResult);
  const actionGraph = compileActionGraph(plan);
  const receipt = await executeActionGraph(actionGraph);

  assert.equal(policyResult.decision, "review");
  assert.equal(actionGraph.approval_status, "required");
  assert.equal(receipt.status, "awaiting_approval");
});

test("missing consent blocks personalization decision", async () => {
  const event = await loadCheckoutEvent();
  const ingress = createEventIngress();
  const ingested = ingress.ingestCheckoutEvent(event);
  const { request, context } = assembleDecisionContext(ingested, {
    personalization_allowed: false
  });
  const policyResult = evaluatePolicies(request, context);

  assert.equal(policyResult.decision, "block");
  assert.equal(policyResult.allowed, false);
});

test("low margin basket requires review", async () => {
  const event = await loadCheckoutEvent();
  event.basket.items = event.basket.items.map((item) => ({
    ...item,
    margin_percent: 10
  }));

  const ingress = createEventIngress();
  const ingested = ingress.ingestCheckoutEvent(event);
  const { request, context } = assembleDecisionContext(ingested);
  const policyResult = evaluatePolicies(request, context);

  assert.equal(policyResult.decision, "review");
  assert.equal(policyResult.requires_approval, true);
});

test("large basket exposure requires review", async () => {
  const event = await loadCheckoutEvent();
  event.event_id = "evt_large_basket_001";
  event.basket.subtotal = 500;

  const ingress = createEventIngress();
  const ingested = ingress.ingestCheckoutEvent(event);
  const { request, context } = assembleDecisionContext(ingested);
  const policyResult = evaluatePolicies(request, context);

  assert.equal(policyResult.decision, "review");
});

test("invalid checkout event is rejected by schema validation", async () => {
  const event = await loadCheckoutEvent();
  delete event.customer.customer_id;
  const ingress = createEventIngress();

  assert.throws(() => ingress.ingestCheckoutEvent(event), /CheckoutEvent.customer is missing required fields/);
});

test("action compiler rejects unknown action types", async () => {
  const event = await loadCheckoutEvent();
  const { plan } = await runUntilPlan(event);
  plan.candidate_actions = [
    {
      type: "UNKNOWN_ACTION_TYPE",
      connector_id: "loyalty_core_demo",
      operation_id: "apply_points_multiplier",
      parameters: {},
      policy_refs: ["policy.demo"],
      rollback: {
        strategy: "manual",
        operation_id: "rollback"
      }
    }
  ];

  assert.throws(() => compileActionGraph(plan), /Unknown action type/);
});

test("action compiler rejects missing policy refs", async () => {
  const event = await loadCheckoutEvent();
  const { plan } = await runUntilPlan(event);
  delete plan.candidate_actions[0].policy_refs;

  assert.throws(() => compileActionGraph(plan), /must include policy_refs/);
});

test("audit ledger records a complete phase 1 run", async () => {
  const event = await loadCheckoutEvent();
  const run = await runFullPipeline(event);
  const ledger = createAuditLedger();
  const records = recordPhase1Run(ledger, run);

  assert.equal(records.length, 5);
  assert.deepEqual(
    records.map((record) => record.type),
    [
      "decision.request.created",
      "policy.evaluated",
      "decision.plan.created",
      "action_graph.compiled",
      "execution.receipt.created"
    ]
  );
  assert.ok(records.every((record) => record.payload_hash));
});

test("control room snapshot summarizes audit records", async () => {
  const event = await loadCheckoutEvent();
  const run = await runFullPipeline(event);
  const ledger = createAuditLedger();
  const records = recordPhase1Run(ledger, run);
  const snapshot = buildControlRoomSnapshot(records);

  assert.equal(snapshot.decisions_created, 1);
  assert.equal(snapshot.action_graphs_compiled, 1);
  assert.equal(snapshot.latest_execution_status, "completed");
});

test("evaluation passes for a safe completed run", async () => {
  const event = await loadCheckoutEvent();
  const run = await runFullPipeline(event);
  const evaluation = evaluatePhase1Run(run);

  assert.equal(evaluation.status, "pass");
  assert.equal(evaluation.checks.every((check) => check.passed), true);
});

test("live data gateway redacts sensitive customer and payment fields", async () => {
  const event = await loadCheckoutEvent();
  event.customer.email = "customer@example.com";
  event.customer.phone = "+15550000000";
  event.payment = {
    card_number: "4111111111111111",
    cvv: "123"
  };

  assert.equal(containsSensitiveFields(event), true);

  const normalized = normalizeLiveEvent(event);

  assert.equal(normalized.ok, true);
  assert.equal(containsSensitiveFields(normalized.event), false);
});

test("live data gateway supports partial batch success", async () => {
  const validEvent = await loadCheckoutEvent();
  const invalidEvent = {
    event_id: "evt_bad_001",
    tenant_id: "tenant_demo_retail",
    event_type: "unknown.event"
  };
  const gateway = createLiveDataGateway();
  const result = gateway.ingestBatch([validEvent, invalidEvent]);

  assert.equal(result.accepted_count, 1);
  assert.equal(result.rejected_count, 1);
  assert.equal(result.rejected[0].reason, "UNSUPPORTED_EVENT_TYPE");
});

test("live data gateway rejects malformed basket", async () => {
  const event = await loadCheckoutEvent();
  event.event_id = "evt_malformed_basket_001";
  delete event.basket.items;

  const result = normalizeLiveEvent(event);

  assert.equal(result.ok, false);
  assert.equal(result.rejection.reason, "MALFORMED_BASKET");
});

async function loadCheckoutEvent() {
  return JSON.parse(
    await readFile(new URL("../examples/fixtures/checkout-event.sample.json", import.meta.url), "utf8")
  );
}

async function runUntilPlan(event) {
  const ingress = createEventIngress();
  const ingested = ingress.ingestCheckoutEvent(event);
  const { request, context, context_pack: contextPack } = assembleDecisionContext(ingested);
  const policyResult = evaluatePolicies(request, context);
  const plan = createDecisionPlan(request, context, policyResult);

  return {
    request,
    context,
    contextPack,
    policyResult,
    plan
  };
}

async function runFullPipeline(event) {
  const planRun = await runUntilPlan(event);
  const actionGraph = compileActionGraph(planRun.plan);
  const receipt = await executeActionGraph(actionGraph);

  return {
    ...planRun,
    actionGraph,
    receipt
  };
}
