import {
  ACTION_TYPES,
  makeStableId,
  validateDecisionPlan
} from "../../../packages/schemas/src/index.js";

export function createDecisionPlan(request, context, policyResult) {
  const candidateActions = buildCandidateActions(request, context, policyResult);
  const plan = {
    decision_id: makeStableId("dec", {
      request_id: request.request_id,
      policy_decision: policyResult.decision,
      actions: candidateActions
    }),
    request_id: request.request_id,
    summary: summarizeDecision(policyResult),
    evidence: [
      ...policyResult.policy_refs.map((ref) => ({ type: "policy", ref })),
      ...request.context_refs.map((ref) => ({ type: "context", ref }))
    ],
    risk_score: context.fraud.risk_score,
    expected_impact: estimateImpact(context, policyResult),
    candidate_actions: candidateActions,
    requires_approval: policyResult.requires_approval,
    model_version: "deterministic-phase1-v0",
    policy_version: policyResult.policy_version
  };

  validateDecisionPlan(plan);
  return plan;
}

function buildCandidateActions(request, context, policyResult) {
  if (policyResult.decision === "block") {
    return [
      {
        type: ACTION_TYPES.CREATE_FRAUD_CASE,
        connector_id: "fraud_platform_demo",
        operation_id: "create_case",
        parameters: {
          customer_id: request.subject.customer_id,
          request_id: request.request_id,
          risk_score: context.fraud.risk_score,
          reason: "Hard block policy triggered."
        },
        policy_refs: policyResult.policy_refs,
        rollback: {
          strategy: "manual_review",
          operation_id: "close_case"
        }
      }
    ];
  }

  if (policyResult.requires_approval) {
    return [
      {
        type: ACTION_TYPES.SEND_TO_REVIEW,
        connector_id: "review_queue_demo",
        operation_id: "create_review_task",
        parameters: {
          request_id: request.request_id,
          customer_id: request.subject.customer_id,
          reason: "Policy requires human approval."
        },
        policy_refs: policyResult.policy_refs,
        rollback: {
          strategy: "cancel_review_task",
          operation_id: "cancel_review_task"
        }
      }
    ];
  }

  return [
    {
      type: ACTION_TYPES.APPLY_POINTS_MULTIPLIER,
      connector_id: "loyalty_core_demo",
      operation_id: "apply_points_multiplier",
      parameters: {
        customer_id: request.subject.customer_id,
        basket_id: context.basket.basket_id,
        multiplier: 2,
        eligible_sku_scope: context.basket.items
          .filter((item) => item.margin_percent >= 30)
          .map((item) => item.sku),
        expires_at: new Date(Date.parse(request.event_time) + 60 * 60 * 1000).toISOString()
      },
      policy_refs: policyResult.policy_refs,
      rollback: {
        strategy: "compensating_action",
        operation_id: "remove_points_multiplier"
      }
    }
  ];
}

function summarizeDecision(policyResult) {
  if (policyResult.decision === "block") {
    return "Block automatic loyalty action and create a fraud case.";
  }

  if (policyResult.decision === "review") {
    return "Route the checkout decision to human review before execution.";
  }

  return "Apply a safe loyalty points multiplier to eligible high-margin items.";
}

function estimateImpact(context, policyResult) {
  if (policyResult.decision === "block") {
    return {
      retention_lift: 0,
      gross_margin_delta: 0,
      budget_impact: 0,
      fraud_loss_prevented_estimate: Number((context.basket.subtotal * context.fraud.risk_score).toFixed(2))
    };
  }

  if (policyResult.decision === "review") {
    return {
      retention_lift: 0.005,
      gross_margin_delta: 0,
      budget_impact: 0,
      fraud_loss_prevented_estimate: 0
    };
  }

  return {
    retention_lift: 0.02,
    gross_margin_delta: Number((context.basket.subtotal * 0.03).toFixed(2)),
    budget_impact: Number((context.basket.subtotal * 0.01).toFixed(2)),
    fraud_loss_prevented_estimate: 0
  };
}
