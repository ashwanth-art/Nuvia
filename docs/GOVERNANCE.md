# Governance

Governance is the main safety layer of Nuvia.

## Governance Principle

No action without authority. No authority without policy. No policy without ownership. No decision without audit.

## Policy Types

- Eligibility policy.
- Discount policy.
- Points redemption policy.
- Margin policy.
- Fraud policy.
- Consent policy.
- Campaign launch policy.
- Partner contract policy.
- Approval policy.
- Data retention policy.

## Policy Requirements

Each policy should be:

- Versioned.
- Owned.
- Testable.
- Simulatable.
- Approved.
- Rollback-capable.
- Environment-scoped.
- Linked to audit events.

## Enforcement Stages

1. Preflight enforcement before reasoning.
2. Plan enforcement after a decision plan is created.
3. Execution enforcement immediately before connector calls.
4. Outcome enforcement after execution for anomaly detection.

## Human Approval Required When

- Financial exposure exceeds threshold.
- Customer impact is high.
- Fraud action restricts account access.
- Required evidence is missing.
- Policy confidence is low.
- Agent confidence is low.
- Action is irreversible.
- New connector or new action type is used.

## Kill Switches

- Tenant kill switch.
- Domain kill switch.
- Agent kill switch.
- Connector kill switch.
- Campaign kill switch.
- Policy version rollback.
- Customer segment suppression.
- Action type disablement.
- Model version rollback.
