# Test Strategy

Nuvia needs many test cases because it makes business decisions that can affect customers, fraud, margin, and compliance.

## Test Layers

## 1. Unit Tests

Purpose:

- Test one module at a time.

Examples:

- Schema validation.
- Policy checks.
- Action compiler validation.
- Connector registry lookup.
- Audit ledger append.

## 2. Contract Tests

Purpose:

- Ensure all modules agree on shared objects.

Contracts:

- Checkout event.
- Decision request.
- Decision plan.
- Action graph.
- Execution receipt.
- Decision context pack.

## 3. Pipeline Tests

Purpose:

- Test full Phase 1 flow.

Flow:

```text
event -> ingress -> context -> policy -> plan -> action graph -> execution -> audit -> dashboard
```

## 4. Policy Tests

Purpose:

- Prove policy behavior is correct.

Scenarios:

- safe checkout allow.
- medium fraud review.
- high fraud block.
- low margin review.
- missing consent block.
- large basket review.

## 5. Live Data Tests

Purpose:

- Prove live data is safe before entering decision logic.

Scenarios:

- sensitive fields redacted.
- unsupported event rejected.
- partial batch accepted.
- malformed record rejected.

## 6. Execution Tests

Purpose:

- Prove safe action execution.

Scenarios:

- valid action executes.
- unknown connector rejected.
- unknown operation rejected.
- approval-required action does not execute.
- duplicate idempotency key does not execute twice.
- connector failure produces failed receipt.
- compensation runs after partial failure.

## 7. Audit Tests

Purpose:

- Prove every decision has proof.

Scenarios:

- decision request recorded.
- policy result recorded.
- action graph recorded.
- execution receipt recorded.
- payload hash exists.

## 8. Security Tests

Purpose:

- Prevent unsafe data exposure.

Scenarios:

- PII redacted.
- secrets not present in output.
- tenant ID required.
- cross-tenant context rejected.
- raw URLs rejected.

## Test Command

Run:

```bash
npm test
```

## Minimum Coverage Target

Before real live data:

- event ingress: 90 percent of branches.
- policy service: all allow/review/block cases.
- action compiler: all rejection reasons.
- execution OS: success, approval, failure, duplicate.
- live data gateway: all sanitization cases.

## Release Rule

No live data connector should be merged unless it has:

- unit tests.
- contract tests.
- sanitization tests.
- failure tests.
- audit tests.
