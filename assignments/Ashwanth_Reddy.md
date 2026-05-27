# Assignment: Ashwanth Reddy

## Track

Decision Core and Governance.

## Mission

Build the foundation that converts raw business events into safe, policy-aware decision requests.

This work should make Nuvia understand:

- What event happened.
- Which tenant/company it belongs to.
- Which customer, basket, loyalty wallet, and policy context is relevant.
- Whether the request is allowed to continue.
- What action types are valid.

## Independent Inputs

Use these files as input:

- `examples/fixtures/checkout-event.sample.json`
- `examples/fixtures/decision-request.sample.json`

You do not need to wait for execution, UI, or agent work.

## Deliverables

1. Define the canonical retail domain model:
   - Customer
   - Basket
   - Product
   - Loyalty wallet
   - Offer
   - Policy
   - Fraud signal
   - Decision request

2. Create the decision contract specification:
   - `DecisionRequest`
   - `DecisionPlan`
   - `ActionGraph`
   - `ExecutionReceipt`
   - `DecisionContextPack`

3. Design the event ingress logic:
   - Event validation
   - Tenant resolution
   - Consent check
   - Schema validation
   - Deduplication
   - Replay protection

4. Design the context assembly logic:
   - Customer context
   - Basket context
   - Loyalty context
   - Margin context
   - Fraud context
   - Policy context

5. Create policy examples:
   - Maximum discount policy
   - Points redemption risk policy
   - Consent policy
   - Margin floor policy
   - Human approval threshold policy

6. Define action registry rules:
   - Allowed action types
   - Required parameters
   - Policy references
   - Idempotency requirements
   - Rollback requirements

## Suggested Folder Ownership

- `services/event-ingress`
- `services/context-assembly`
- `services/policy-service`
- `services/action-compiler`
- `packages/schemas`
- `docs/DECISION_CONTRACTS.md`
- `docs/GOVERNANCE.md`

## Starter Code Files

- `services/event-ingress/src/index.js`
- `services/context-assembly/src/index.js`
- `services/policy-service/src/index.js`
- `services/action-compiler/src/index.js`
- `packages/schemas/src/index.js`

## Output Expected

By the end of this track, the project should clearly show how a checkout event becomes a validated `DecisionRequest` and how policies decide whether it can become an action.

## Done Means

- Sample checkout event can be mapped to a sample decision request.
- Policy examples are documented.
- Action types and validation rules are listed.
- No AI execution is required for this track.
