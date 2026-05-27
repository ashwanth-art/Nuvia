# Assignment: Ashwanth Reddy

## Track

Decision Core, Context Assembly, Policy Governance, and Action Compilation.

## One-Line Responsibility

Ashwanth owns the part of Nuvia that turns a raw checkout event into a safe, structured, policy-checked decision and typed action graph.

## Product Area

This track is the brain and rule boundary of the Phase 1 system.

It answers:

- What event happened?
- Which tenant and customer does it belong to?
- Is the event valid?
- What context is required?
- What policies apply?
- Is the decision allowed, blocked, or review-required?
- Can the candidate action be compiled into a safe `ActionGraph`?

## Independent Working Rule

This work should not wait for UI, connectors, audit, or deployment.

Use local sample files and mock context:

- `examples/fixtures/checkout-event.sample.json`
- `examples/fixtures/decision-request.sample.json`
- `examples/fixtures/action-graph.sample.json`

As long as these files are valid, Ashwanth can build and test this track independently.

## Main Files Owned

- `packages/schemas/src/index.js`
- `services/event-ingress/src/index.js`
- `services/context-assembly/src/index.js`
- `services/policy-service/src/index.js`
- `services/action-compiler/src/index.js`
- `docs/DECISION_CONTRACTS.md`
- `docs/GOVERNANCE.md`
- `examples/fixtures/checkout-event.sample.json`
- `examples/fixtures/decision-request.sample.json`
- `examples/fixtures/action-graph.sample.json`

## Current Starter Code

The repo already contains starter functions:

- `validateCheckoutEvent`
- `validateDecisionRequest`
- `validateDecisionPlan`
- `validateActionGraph`
- `createEventIngress`
- `assembleDecisionContext`
- `evaluatePolicies`
- `compileActionGraph`

Ashwanth should improve these into stronger Phase 1 modules.

## Detailed Tasks

### 1. Strengthen Shared Schemas

File:

- `packages/schemas/src/index.js`

Work:

- Define all Phase 1 constants clearly.
- Add action types:
  - `LOYALTY_APPLY_POINTS_MULTIPLIER`
  - `LOYALTY_APPROVE_REDEMPTION`
  - `LOYALTY_BLOCK_REDEMPTION`
  - `FRAUD_REQUEST_STEP_UP_VERIFICATION`
  - `FRAUD_CREATE_CASE`
  - `NUVIA_SEND_TO_HUMAN_REVIEW`
  - `NUVIA_NO_ACTION`
- Add event types:
  - `checkout.started`
  - `loyalty.redemption.requested`
  - `checkout.completed`
  - `checkout.cancelled`
- Add decision domains:
  - `loyalty.checkout_offer`
  - `loyalty.redemption_governance`
- Improve validation errors so developers know exactly what field failed.
- Add validation for nested fields:
  - customer
  - basket
  - basket items
  - source system
  - policy refs
  - rollback strategy

Expected output:

- Strong schema helpers used by all services.
- Clear validation error messages.
- No dependency on external libraries yet.

### 2. Expand Event Ingress

File:

- `services/event-ingress/src/index.js`

Work:

- Keep `createEventIngress`.
- Add support for multiple event types, not only checkout.
- Validate:
  - tenant ID exists
  - source system exists
  - event time exists and is valid
  - event type is allowed
  - customer ID exists where required
  - basket exists for checkout events
- Add event status outputs:
  - `accepted`
  - `duplicate`
  - `rejected`
- Add rejection reasons:
  - `INVALID_SCHEMA`
  - `UNKNOWN_EVENT_TYPE`
  - `MISSING_TENANT`
  - `MISSING_CUSTOMER`
  - `REPLAY_DETECTED`
- Make deduplication deterministic using `event_id`.
- Add a small in-memory event registry for local development.

Expected output:

- A raw event can be accepted, rejected, or marked duplicate.
- Team can call ingress without knowing internal validation logic.

### 3. Expand Context Assembly

File:

- `services/context-assembly/src/index.js`

Work:

- Improve `assembleDecisionContext`.
- Create separate context builder functions:
  - `buildCustomerContext`
  - `buildBasketContext`
  - `buildLoyaltyContext`
  - `buildMarginContext`
  - `buildFraudContext`
  - `buildPolicyContext`
- Add missing-context behavior:
  - if optional context is missing, record it in `missing_context_refs`
  - if required context is missing, mark the decision as review-required
- Add redaction list:
  - never expose email
  - never expose phone
  - never expose raw address
  - never expose payment information
- Improve `DecisionContextPack`:
  - admitted context
  - missing context
  - rejected context
  - redacted fields
  - context hash
  - policy bundle ref

Expected output:

- Checkout event becomes a complete `DecisionRequest`.
- Context pack shows exactly what context was used.

### 4. Build Policy Evaluation Rules

File:

- `services/policy-service/src/index.js`

Work:

- Expand `DEFAULT_POLICIES`.
- Implement these policy checks:
  - consent check
  - margin floor check
  - fraud score check
  - basket exposure check
  - max points multiplier check
  - high-value redemption check
  - quiet-hours customer notification check
- Return standard policy result:
  - `allow`
  - `review`
  - `block`
- Each policy check must include:
  - `policy_ref`
  - `result`
  - `severity`
  - `message`
  - `evidence`

Expected output:

- Policy result is understandable and audit-ready.
- Agent or execution code should not make policy decisions separately.

### 5. Expand Action Compiler

File:

- `services/action-compiler/src/index.js`

Work:

- Expand `ACTION_REGISTRY`.
- Add required parameter validation per action.
- Add connector allowlist per action.
- Reject action if:
  - unknown action type
  - missing connector ID
  - missing operation ID
  - missing policy refs
  - missing idempotency key
  - missing rollback for reversible actions
  - unsupported connector for action type
- Add approval status:
  - `not_required`
  - `required`
  - `approved`
  - `rejected`
- Add helper:
  - `validateActionAgainstRegistry(action)`
  - `compileAction(action, index)`

Expected output:

- Unsafe actions never reach execution.
- `ActionGraph` is typed and predictable.

### 6. Update Contract Documentation

Files:

- `docs/DECISION_CONTRACTS.md`
- `docs/GOVERNANCE.md`

Work:

- Update docs to match actual code fields.
- Add field tables for:
  - `CheckoutEvent`
  - `DecisionRequest`
  - `DecisionPlan`
  - `ActionGraph`
  - `ExecutionReceipt`
  - `DecisionContextPack`
- Add examples for allow, review, and block decisions.

Expected output:

- New teammate can read docs and understand the backend contract.

## Suggested Implementation Order

1. Update schema constants and validators.
2. Improve event ingress validation.
3. Improve context assembly and context pack.
4. Expand policy checks.
5. Expand action compiler registry.
6. Add or update tests.
7. Update docs.

## Tests To Add

Add tests in:

- `tests/phase1.test.mjs`

Required tests:

- valid checkout event is accepted
- duplicate event is detected
- invalid event is rejected
- missing consent causes block or review
- low margin causes review
- high fraud score causes block
- medium fraud score causes review
- safe checkout produces points multiplier action
- unknown action type is rejected by compiler
- missing policy refs are rejected by compiler

## Acceptance Criteria

Ashwanth's track is complete when:

- `npm test` passes.
- Demo still runs with `npm run demo`.
- Event ingress returns clear statuses.
- Context assembly creates a valid `DecisionRequest`.
- Policy service returns allow/review/block with policy refs.
- Action compiler rejects unsafe actions.
- Docs match actual code behavior.

## Final Deliverable

A reliable Phase 1 decision core that teammates can use as a base:

```text
raw event -> accepted event -> decision request -> policy result -> compiled action graph
```

## Out Of Scope

Do not build:

- UI screens.
- Real external connectors.
- Database persistence.
- AI model calls.
- Cloud infrastructure.

Those belong to other tracks.
