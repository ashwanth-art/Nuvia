import { readFile } from "node:fs/promises";
import { buildControlRoomSnapshot, formatControlRoomSnapshot } from "../apps/control-room/src/dashboard.js";
import { evaluatePhase1Run } from "../packages/evaluation/src/index.js";
import { compileActionGraph } from "../services/action-compiler/src/index.js";
import { createDecisionPlan } from "../services/agent-orchestrator/src/index.js";
import { createAuditLedger, recordPhase1Run } from "../services/audit-ledger/src/index.js";
import { assembleDecisionContext } from "../services/context-assembly/src/index.js";
import { createEventIngress } from "../services/event-ingress/src/index.js";
import { executeActionGraph } from "../services/execution-os/src/index.js";
import { evaluatePolicies } from "../services/policy-service/src/index.js";

const checkoutEvent = JSON.parse(
  await readFile(new URL("./fixtures/checkout-event.sample.json", import.meta.url), "utf8")
);

const ingress = createEventIngress();
const ledger = createAuditLedger();

const ingestedEvent = ingress.ingestCheckoutEvent(checkoutEvent);
const { request, context, context_pack: contextPack } = assembleDecisionContext(ingestedEvent);
const policyResult = evaluatePolicies(request, context);
const plan = createDecisionPlan(request, context, policyResult);
const actionGraph = compileActionGraph(plan);
const receipt = await executeActionGraph(actionGraph);
const auditRecords = recordPhase1Run(ledger, {
  request,
  contextPack,
  policyResult,
  plan,
  actionGraph,
  receipt
});
const evaluation = evaluatePhase1Run({
  request,
  policyResult,
  actionGraph,
  receipt
});
const snapshot = buildControlRoomSnapshot(auditRecords);

console.log("Nuvia Phase 1 Demo");
console.log("==================");
console.log(`Request: ${request.request_id}`);
console.log(`Policy decision: ${policyResult.decision}`);
console.log(`Decision summary: ${plan.summary}`);
console.log(`Action graph: ${actionGraph.action_graph_id}`);
console.log(`Execution status: ${receipt.status}`);
console.log(`Evaluation: ${evaluation.status}`);
console.log("");
console.log(formatControlRoomSnapshot(snapshot));
