# Architecture

Nuvia is organized as a decision orchestration system. The agent is only one part of the system. The stronger product boundary is made from policies, contracts, execution controls, connectors, and audit.

## Architecture Planes

## 1. Enterprise Event Sources

Systems that send business events to Nuvia:

- POS
- Ecommerce
- Loyalty platform
- CRM
- Inventory
- Pricing
- Fraud system
- Customer support
- Partner systems

## 2. Ingress And Identity Plane

Responsibilities:

- Authenticate source system.
- Resolve tenant.
- Validate schema.
- Check consent and privacy rules.
- Deduplicate event.
- Prevent replay.
- Send valid event into stream.

## 3. Context And Memory Plane

Responsibilities:

- Build `DecisionRequest`.
- Add customer, basket, loyalty, margin, fraud, inventory, campaign, and policy context.
- Track which context was used, missing, stale, rejected, or redacted.

## 4. Governance Plane

Responsibilities:

- Policy preflight.
- Approval rules.
- Budget controls.
- Margin controls.
- Consent policies.
- Kill switches.
- Policy versioning.

## 5. Agentic Reasoning Plane

Responsibilities:

- Agent orchestration.
- Loyalty recommendation.
- Fraud analysis.
- Margin warning.
- Campaign or promotion suggestions.
- Explanation generation.

Agents produce plans. They do not execute actions directly.

## 6. Decision Compilation Plane

Responsibilities:

- Risk scoring.
- Simulation check.
- Action compiler.
- Action schema validation.
- Typed `ActionGraph` generation.

## 7. Human Control Plane

Responsibilities:

- Approval queue.
- Reviewer workbench.
- Approval signoff.
- Rejection.
- Escalation.

## 8. Execution Plane

Responsibilities:

- Durable workflow execution.
- Idempotency.
- Retries.
- Timeouts.
- Compensation.
- Dead-letter routing.
- Execution receipt.

## 9. Audit, Observability, And Learning Plane

Responsibilities:

- Immutable decision ledger.
- Execution receipts.
- Replay lab.
- Business metrics.
- SIEM export.
- OpenTelemetry traces.
- Evaluation results.
- Outcome learning loop.

## Architecture Rule

AI can recommend. Policy authorizes. Compiler validates. Execution OS acts. Audit records.
