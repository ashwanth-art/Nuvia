export const DEFAULT_POLICIES = Object.freeze({
  consent_required: true,
  minimum_average_margin_percent: 25,
  max_points_multiplier: 2,
  review_fraud_risk_threshold: 0.45,
  block_fraud_risk_threshold: 0.8,
  human_review_basket_threshold: 250
});

export function evaluatePolicies(request, context, policies = DEFAULT_POLICIES) {
  const checks = [
    checkConsent(context, policies),
    checkMargin(context, policies),
    checkFraudRisk(context, policies),
    checkBasketExposure(context, policies)
  ];

  const blocked = checks.some((check) => check.result === "block");
  const review = checks.some((check) => check.result === "review");

  return {
    request_id: request.request_id,
    policy_version: context.policy.version,
    allowed: !blocked,
    requires_approval: !blocked && review,
    decision: blocked ? "block" : review ? "review" : "allow",
    checks,
    policy_refs: checks.map((check) => check.policy_ref)
  };
}

function checkConsent(context, policies) {
  const allowed = !policies.consent_required || context.customer.personalization_allowed;

  return {
    policy_ref: "policy.consent.personalization.demo_v1",
    result: allowed ? "pass" : "block",
    message: allowed ? "Personalization consent is valid." : "Personalization consent is missing."
  };
}

function checkMargin(context, policies) {
  const marginOk = context.margin.average_margin_percent >= policies.minimum_average_margin_percent;

  return {
    policy_ref: "policy.margin.floor.demo_v1",
    result: marginOk ? "pass" : "review",
    message: marginOk
      ? "Basket margin is inside allowed range."
      : "Basket margin is below preferred floor and needs review."
  };
}

function checkFraudRisk(context, policies) {
  if (context.fraud.risk_score >= policies.block_fraud_risk_threshold) {
    return {
      policy_ref: "policy.fraud.block.demo_v1",
      result: "block",
      message: "Fraud score is above hard-block threshold."
    };
  }

  if (context.fraud.risk_score >= policies.review_fraud_risk_threshold) {
    return {
      policy_ref: "policy.fraud.review.demo_v1",
      result: "review",
      message: "Fraud score requires human review."
    };
  }

  return {
    policy_ref: "policy.fraud.allow.demo_v1",
    result: "pass",
    message: "Fraud score is inside allowed range."
  };
}

function checkBasketExposure(context, policies) {
  const needsReview = context.basket.subtotal >= policies.human_review_basket_threshold;

  return {
    policy_ref: "policy.exposure.basket.demo_v1",
    result: needsReview ? "review" : "pass",
    message: needsReview
      ? "Basket exposure exceeds auto-approval threshold."
      : "Basket exposure is within auto-approval threshold."
  };
}
