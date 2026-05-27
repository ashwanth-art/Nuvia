# Context Assembly Service

Builds decision-ready context.

Responsibilities:

- Read valid business events.
- Fetch customer, basket, loyalty, margin, fraud, consent, and policy context.
- Produce `DecisionRequest`.
- Record what context was used, missing, stale, rejected, or redacted.
