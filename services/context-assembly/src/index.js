import {
  DECISION_DOMAINS,
  makeStableId,
  stableHash,
  validateDecisionRequest
} from "../../../packages/schemas/src/index.js";

export function assembleDecisionContext(ingressResult, overrides = {}) {
  if (ingressResult.status !== "accepted") {
    throw new Error(`Cannot assemble context for ingress status: ${ingressResult.status}`);
  }

  const event = ingressResult.event;
  const context = buildContextFromCheckoutEvent(event, overrides);
  const request = {
    request_id: makeStableId("req", {
      tenant_id: event.tenant_id,
      event_id: event.event_id,
      domain: DECISION_DOMAINS.CHECKOUT_OFFER
    }),
    tenant_id: event.tenant_id,
    event_type: event.event_type,
    event_time: event.event_time,
    actor: {
      type: "system",
      id: event.source.terminal_id ?? event.source.system
    },
    subject: {
      customer_id: event.customer.customer_id,
      consent_profile_id: event.customer.consent_profile_id
    },
    decision_domain: DECISION_DOMAINS.CHECKOUT_OFFER,
    latency_budget_ms: overrides.latency_budget_ms ?? 250,
    risk_tier: deriveRiskTier(context.fraud.risk_score),
    context_refs: [
      context.customer.ref,
      context.basket.ref,
      context.loyalty_wallet.ref,
      context.margin.ref,
      context.fraud.ref,
      context.policy.ref
    ],
    policy_bundle_ref: context.policy.ref
  };

  validateDecisionRequest(request);

  return {
    request,
    context,
    context_pack: {
      context_pack_id: makeStableId("dcp", request),
      request_id: request.request_id,
      context_hash: stableHash(context),
      admitted_context_refs: request.context_refs,
      missing_context_refs: [],
      rejected_context_refs: [],
      redacted_fields: ["customer.email", "customer.phone"]
    }
  };
}

export function buildContextFromCheckoutEvent(event, overrides = {}) {
  const averageMarginPercent = calculateAverageMarginPercent(event.basket.items);
  const fraudRiskScore = overrides.fraud_risk_score ?? 0.18;

  return {
    customer: {
      ref: `ctx_customer_profile_${event.customer.customer_id}`,
      customer_id: event.customer.customer_id,
      segment: overrides.segment ?? "returning_loyalty_member",
      consent_profile_id: event.customer.consent_profile_id,
      personalization_allowed: overrides.personalization_allowed ?? true
    },
    basket: {
      ref: `ctx_basket_${event.basket.basket_id}`,
      basket_id: event.basket.basket_id,
      subtotal: event.basket.subtotal,
      currency: event.basket.currency,
      items: event.basket.items
    },
    loyalty_wallet: {
      ref: `ctx_loyalty_wallet_${event.customer.loyalty_id}`,
      loyalty_id: event.customer.loyalty_id,
      points_balance: overrides.points_balance ?? 4200,
      tier: overrides.tier ?? "gold"
    },
    margin: {
      ref: `ctx_margin_${event.basket.basket_id}`,
      average_margin_percent: averageMarginPercent
    },
    fraud: {
      ref: `ctx_fraud_${event.customer.customer_id}`,
      risk_score: fraudRiskScore,
      signals: overrides.fraud_signals ?? ["normal_velocity", "known_device"]
    },
    policy: {
      ref: overrides.policy_bundle_ref ?? "policy_bundle_demo_v1",
      version: overrides.policy_version ?? "demo_v1"
    }
  };
}

function calculateAverageMarginPercent(items) {
  const total = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const weightedMargin = items.reduce((sum, item) => {
    return sum + item.unit_price * item.quantity * item.margin_percent;
  }, 0);

  return Number((weightedMargin / total).toFixed(2));
}

function deriveRiskTier(riskScore) {
  if (riskScore >= 0.7) {
    return "high";
  }

  if (riskScore >= 0.4) {
    return "medium";
  }

  return "low";
}
