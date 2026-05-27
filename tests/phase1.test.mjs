import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { compileActionGraph } from "../services/action-compiler/src/index.js";
import { createDecisionPlan } from "../services/agent-orchestrator/src/index.js";
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

async function loadCheckoutEvent() {
  return JSON.parse(
    await readFile(new URL("../examples/fixtures/checkout-event.sample.json", import.meta.url), "utf8")
  );
}
