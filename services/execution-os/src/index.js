import { executeConnectorAction } from "../../../packages/connectors/src/index.js";
import {
  makeStableId,
  validateActionGraph,
  validateExecutionReceipt
} from "../../../packages/schemas/src/index.js";

export async function executeActionGraph(actionGraph, options = {}) {
  validateActionGraph(actionGraph);

  if (actionGraph.approval_status === "required") {
    return createReceipt(actionGraph, "awaiting_approval", [], options);
  }

  const executor = options.executor ?? executeConnectorAction;
  const actionResults = [];

  for (const action of actionGraph.actions) {
    const result = await executor(action);
    actionResults.push(result);
  }

  return createReceipt(actionGraph, "completed", actionResults, options);
}

function createReceipt(actionGraph, status, actionResults, options) {
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const completedAt = now().toISOString();
  const receipt = {
    receipt_id: makeStableId("rec", {
      action_graph_id: actionGraph.action_graph_id,
      status,
      actionResults
    }),
    action_graph_id: actionGraph.action_graph_id,
    status,
    started_at: startedAt,
    completed_at: completedAt,
    actions: actionResults,
    audit_ref: makeStableId("audit", {
      action_graph_id: actionGraph.action_graph_id,
      status
    })
  };

  validateExecutionReceipt(receipt);
  return receipt;
}
