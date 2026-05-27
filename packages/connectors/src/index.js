import { makeStableId } from "../../schemas/src/index.js";

export const CONNECTOR_REGISTRY = Object.freeze({
  loyalty_core_demo: {
    owner: "vijju",
    operations: ["apply_points_multiplier", "remove_points_multiplier"]
  },
  fraud_platform_demo: {
    owner: "vijju",
    operations: ["create_case", "close_case"]
  },
  review_queue_demo: {
    owner: "chaitanya",
    operations: ["create_review_task", "cancel_review_task"]
  },
  notification_demo: {
    owner: "vijju",
    operations: ["send_message"]
  }
});

export async function executeConnectorAction(action, registry = CONNECTOR_REGISTRY) {
  const connector = registry[action.connector_id];

  if (!connector) {
    throw new Error(`Connector is not registered: ${action.connector_id}`);
  }

  if (!connector.operations.includes(action.operation_id)) {
    throw new Error(`Operation ${action.operation_id} is not allowed for connector ${action.connector_id}`);
  }

  return {
    action_id: action.action_id,
    status: "success",
    connector_id: action.connector_id,
    operation_id: action.operation_id,
    external_reference: makeStableId("ext", {
      connector_id: action.connector_id,
      operation_id: action.operation_id,
      parameters: action.parameters
    })
  };
}
