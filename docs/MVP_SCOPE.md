# MVP Scope

## MVP Name

Real-time loyalty offer and fraud-safe redemption governance for enterprise retail checkout.

## MVP Goal

Prove that Nuvia can safely receive checkout/redemption events, assemble decision context, apply policies, prepare actions, execute approved low-risk actions, and record an audit trail.

## In Scope

- Checkout event ingestion.
- Loyalty redemption event ingestion.
- Customer context lookup.
- Basket context lookup.
- Loyalty wallet context.
- Fraud signal context.
- Margin context.
- Consent check.
- Policy preflight.
- Decision request creation.
- Basic deterministic decision rules.
- Agent-drafted recommendation as optional assist.
- Action graph creation.
- Human approval for risky decisions.
- Execution receipt.
- Audit ledger record.
- Control Room skeleton.

## Out Of Scope For First MVP

- Full campaign builder.
- Full digital twin.
- Agent marketplace.
- Autonomous enterprise planning.
- Voice interface.
- Multi-industry expansion.
- Complex partner ecosystem.
- Self-changing policies.

## MVP Decision Types

- Approve loyalty redemption.
- Block loyalty redemption.
- Request step-up verification.
- Apply points multiplier.
- Apply eligible offer.
- Send to human review.
- Create fraud case.
- Do nothing.

## MVP Success Metrics

- Checkout decision completes within target latency.
- Every action has policy references.
- Every execution has receipt.
- Human reviewers can understand why a decision happened.
- Fraud-risk decisions are auditable.
- Margin rules prevent unsafe discounts.
