import { createHash } from "node:crypto";

export const ACTION_TYPES = Object.freeze({
  APPLY_POINTS_MULTIPLIER: "LOYALTY_APPLY_POINTS_MULTIPLIER",
  REQUEST_STEP_UP: "FRAUD_REQUEST_STEP_UP_VERIFICATION",
  CREATE_FRAUD_CASE: "FRAUD_CREATE_CASE",
  SEND_TO_REVIEW: "NUVIA_SEND_TO_HUMAN_REVIEW",
  NO_ACTION: "NUVIA_NO_ACTION"
});

export const DECISION_DOMAINS = Object.freeze({
  CHECKOUT_OFFER: "loyalty.checkout_offer",
  REDEMPTION_GOVERNANCE: "loyalty.redemption_governance"
});

export function stableHash(value) {
  return createHash("sha256")
    .update(JSON.stringify(sortForHash(value)))
    .digest("hex");
}

export function makeStableId(prefix, value) {
  return `${prefix}_${stableHash(value).slice(0, 12)}`;
}

export function assertRequiredFields(value, fields, label) {
  const missing = fields.filter((field) => value[field] === undefined || value[field] === null);

  if (missing.length > 0) {
    throw new ValidationError(`${label} is missing required fields: ${missing.join(", ")}`, {
      label,
      missing
    });
  }
}

export function validateCheckoutEvent(event) {
  assertObject(event, "CheckoutEvent");
  assertRequiredFields(event, ["tenant_id", "event_type", "event_time", "source", "customer", "basket"], "CheckoutEvent");
  assertRequiredFields(event.source, ["system"], "CheckoutEvent.source");
  assertRequiredFields(event.customer, ["customer_id", "loyalty_id", "consent_profile_id"], "CheckoutEvent.customer");
  assertRequiredFields(event.basket, ["basket_id", "currency", "subtotal", "items"], "CheckoutEvent.basket");

  if (!Array.isArray(event.basket.items) || event.basket.items.length === 0) {
    throw new ValidationError("CheckoutEvent.basket.items must contain at least one item");
  }

  return event;
}

export function validateDecisionRequest(request) {
  assertObject(request, "DecisionRequest");
  assertRequiredFields(
    request,
    [
      "request_id",
      "tenant_id",
      "event_type",
      "event_time",
      "actor",
      "subject",
      "decision_domain",
      "latency_budget_ms",
      "risk_tier",
      "context_refs",
      "policy_bundle_ref"
    ],
    "DecisionRequest"
  );

  if (!Array.isArray(request.context_refs)) {
    throw new ValidationError("DecisionRequest.context_refs must be an array");
  }

  return request;
}

export function validateDecisionPlan(plan) {
  assertObject(plan, "DecisionPlan");
  assertRequiredFields(
    plan,
    [
      "decision_id",
      "request_id",
      "summary",
      "evidence",
      "risk_score",
      "expected_impact",
      "candidate_actions",
      "requires_approval",
      "policy_version"
    ],
    "DecisionPlan"
  );

  if (!Array.isArray(plan.candidate_actions)) {
    throw new ValidationError("DecisionPlan.candidate_actions must be an array");
  }

  return plan;
}

export function validateActionGraph(actionGraph) {
  assertObject(actionGraph, "ActionGraph");
  assertRequiredFields(
    actionGraph,
    ["action_graph_id", "decision_id", "idempotency_key", "approval_status", "actions"],
    "ActionGraph"
  );

  if (!Array.isArray(actionGraph.actions)) {
    throw new ValidationError("ActionGraph.actions must be an array");
  }

  return actionGraph;
}

export function validateExecutionReceipt(receipt) {
  assertObject(receipt, "ExecutionReceipt");
  assertRequiredFields(
    receipt,
    ["receipt_id", "action_graph_id", "status", "started_at", "completed_at", "actions", "audit_ref"],
    "ExecutionReceipt"
  );

  if (!Array.isArray(receipt.actions)) {
    throw new ValidationError("ExecutionReceipt.actions must be an array");
  }

  return receipt;
}

export class ValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(`${label} must be an object`);
  }
}

function sortForHash(value) {
  if (Array.isArray(value)) {
    return value.map(sortForHash);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = sortForHash(value[key]);
        return accumulator;
      }, {});
  }

  return value;
}
