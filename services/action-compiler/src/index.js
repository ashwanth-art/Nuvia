import {
  ACTION_TYPES,
  makeStableId,
  validateActionGraph
} from "../../../packages/schemas/src/index.js";

export const ACTION_REGISTRY = Object.freeze({
  [ACTION_TYPES.APPLY_POINTS_MULTIPLIER]: {
    required_parameters: ["customer_id", "basket_id", "multiplier", "eligible_sku_scope", "expires_at"],
    requires_rollback: true
  },
  [ACTION_TYPES.REQUEST_STEP_UP]: {
    required_parameters: ["customer_id", "request_id", "reason"],
    requires_rollback: false
  },
  [ACTION_TYPES.CREATE_FRAUD_CASE]: {
    required_parameters: ["customer_id", "request_id", "risk_score", "reason"],
    requires_rollback: true
  },
  [ACTION_TYPES.SEND_TO_REVIEW]: {
    required_parameters: ["request_id", "customer_id", "reason"],
    requires_rollback: true
  },
  [ACTION_TYPES.NO_ACTION]: {
    required_parameters: ["request_id", "reason"],
    requires_rollback: false
  }
});

export function compileActionGraph(plan) {
  const actions = plan.candidate_actions.map((action, index) => compileAction(action, index));

  const actionGraph = {
    action_graph_id: makeStableId("ag", {
      decision_id: plan.decision_id,
      actions
    }),
    decision_id: plan.decision_id,
    idempotency_key: `decision:${plan.decision_id}`,
    approval_status: plan.requires_approval ? "required" : "not_required",
    actions
  };

  validateActionGraph(actionGraph);
  return actionGraph;
}

function compileAction(action, index) {
  const registryEntry = ACTION_REGISTRY[action.type];

  if (!registryEntry) {
    throw new Error(`Unknown action type: ${action.type}`);
  }

  const missingParameters = registryEntry.required_parameters.filter(
    (parameter) => action.parameters?.[parameter] === undefined || action.parameters?.[parameter] === null
  );

  if (missingParameters.length > 0) {
    throw new Error(`Action ${action.type} is missing parameters: ${missingParameters.join(", ")}`);
  }

  if (!action.connector_id || !action.operation_id) {
    throw new Error(`Action ${action.type} must include connector_id and operation_id`);
  }

  if (!Array.isArray(action.policy_refs) || action.policy_refs.length === 0) {
    throw new Error(`Action ${action.type} must include policy_refs`);
  }

  if (registryEntry.requires_rollback && !action.rollback) {
    throw new Error(`Action ${action.type} must include rollback strategy`);
  }

  return {
    action_id: action.action_id ?? `act_${String(index + 1).padStart(3, "0")}`,
    ...action
  };
}
