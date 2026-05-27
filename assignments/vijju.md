# Assignment: vijju

## Track

Execution OS, Connectors, Audit Ledger, and Observability.

## One-Line Responsibility

vijju owns the part of Nuvia that safely executes approved typed actions and records proof of what happened.

## Product Area

This track is the hands, memory, and operational safety layer of Nuvia.

It answers:

- Can this action be executed safely?
- Which connector should run it?
- Is the connector allowed?
- Did execution succeed or fail?
- Should we retry?
- Should we compensate or dead-letter?
- What receipt and audit trail prove what happened?

## Independent Working Rule

This work should not wait for decision core, UI, or agent work.

Use typed action fixtures and mock connector behavior:

- `examples/fixtures/action-graph.sample.json`
- `examples/fixtures/execution-receipt.sample.json`

As long as an `ActionGraph` object exists, vijju can build and test execution independently.

## Main Files Owned

- `services/execution-os/src/index.js`
- `services/audit-ledger/src/index.js`
- `packages/connectors/src/index.js`
- `infra/local-dev.env.example`
- `docs/INTEGRATION_PLAN.md`
- `examples/fixtures/execution-receipt.sample.json`

## Current Starter Code

The repo already contains starter functions:

- `executeActionGraph`
- `executeConnectorAction`
- `createAuditLedger`
- `recordPhase1Run`
- `CONNECTOR_REGISTRY`

vijju should improve these into a stronger execution framework.

## Detailed Tasks

### 1. Expand Connector Registry

File:

- `packages/connectors/src/index.js`

Work:

- Expand `CONNECTOR_REGISTRY`.
- Add connector definitions for:
  - `loyalty_core_demo`
  - `pos_platform_demo`
  - `commerce_platform_demo`
  - `fraud_platform_demo`
  - `review_queue_demo`
  - `notification_demo`
  - `data_warehouse_demo`
- Each connector should define:
  - `connector_id`
  - `name`
  - `owner`
  - `risk_class`
  - `operations`
  - `timeout_ms`
  - `retry_limit`
  - `rate_limit_per_minute`
  - `supports_compensation`
  - `data_classification`
- Add operation metadata:
  - operation ID
  - required parameters
  - response shape
  - whether operation is reversible

Expected output:

- Connector registry works like an allowlist.
- Unknown connectors and unknown operations are rejected.

### 2. Improve Connector Execution Simulation

File:

- `packages/connectors/src/index.js`

Work:

- Improve `executeConnectorAction`.
- Add validation before executing:
  - connector exists
  - operation exists
  - required parameters exist
  - operation is allowed for action type
- Add mock connector responses:
  - success
  - timeout
  - rate_limited
  - validation_error
  - downstream_error
- Add optional testing flags:
  - `simulate_timeout`
  - `simulate_failure`
  - `simulate_rate_limit`

Expected output:

- Team can test execution success and failure without real enterprise systems.

### 3. Build Execution OS State Machine

File:

- `services/execution-os/src/index.js`

Work:

- Expand `executeActionGraph`.
- Add explicit execution states:
  - `received`
  - `validated`
  - `awaiting_approval`
  - `ready`
  - `executing`
  - `completed`
  - `retrying`
  - `failed`
  - `compensating`
  - `compensated`
  - `dead_letter`
- Create helper functions:
  - `validateExecutableActionGraph`
  - `executeActionWithRetry`
  - `shouldRetry`
  - `createDeadLetterRecord`
  - `createExecutionReceipt`
- Track per-action result:
  - started time
  - completed time
  - status
  - connector ID
  - operation ID
  - external reference
  - error code
  - retry count

Expected output:

- Execution is predictable and easy to audit.
- Failed actions do not disappear silently.

### 4. Add Idempotency Handling

File:

- `services/execution-os/src/index.js`

Work:

- Maintain in-memory idempotency store for local development.
- If same `idempotency_key` runs twice:
  - return previous receipt
  - do not execute connector again
- Store:
  - idempotency key
  - receipt ID
  - action graph ID
  - status

Expected output:

- Same action graph cannot accidentally execute twice.

### 5. Add Compensation Support

Files:

- `services/execution-os/src/index.js`
- `packages/connectors/src/index.js`

Work:

- If action fails after partial success, check rollback strategy.
- If rollback exists, run compensation operation.
- Record compensation result.
- If compensation fails, route to dead letter.

Expected output:

- Execution OS handles partial failures safely.

### 6. Expand Audit Ledger

File:

- `services/audit-ledger/src/index.js`

Work:

- Improve `createAuditLedger`.
- Add audit event types:
  - `event.ingested`
  - `decision.request.created`
  - `policy.evaluated`
  - `decision.plan.created`
  - `action_graph.compiled`
  - `approval.requested`
  - `execution.started`
  - `connector.action.started`
  - `connector.action.completed`
  - `connector.action.failed`
  - `execution.completed`
  - `execution.failed`
  - `execution.compensated`
  - `execution.dead_lettered`
- Add helper queries:
  - `findByRequestId`
  - `findByDecisionId`
  - `findByActionGraphId`
  - `findByType`
- Ensure every record has:
  - audit ID
  - event type
  - payload hash
  - timestamp
  - tenant ID if available
  - correlation ID if available

Expected output:

- Every execution step can be inspected.

### 7. Add Observability Outputs

Files:

- `services/execution-os/src/index.js`
- `services/audit-ledger/src/index.js`

Work:

- Add local metrics object:
  - execution count
  - success count
  - failure count
  - retry count
  - dead-letter count
  - connector error count
- Add trace shape:
  - trace ID
  - request ID
  - action graph ID
  - connector ID
  - operation ID
  - duration
  - status

Expected output:

- Control Room can later show execution health.

### 8. Update Integration Documentation

File:

- `docs/INTEGRATION_PLAN.md`

Work:

- Add connector registry format.
- Add supported mock connectors.
- Add execution state machine.
- Add failure handling rules.
- Add audit event list.

Expected output:

- Team understands how external systems will integrate later.

## Suggested Implementation Order

1. Expand connector registry.
2. Add connector action validation.
3. Improve execution state machine.
4. Add idempotency store.
5. Add retries and failure behavior.
6. Add compensation/dead-letter behavior.
7. Expand audit ledger.
8. Add tests.
9. Update docs.

## Tests To Add

Add tests in:

- `tests/phase1.test.mjs`

Required tests:

- valid action graph executes successfully
- unknown connector is rejected
- unknown operation is rejected
- duplicate idempotency key does not execute twice
- approval-required action graph returns `awaiting_approval`
- simulated connector failure returns failed receipt
- retryable failure retries
- non-retryable failure does not retry
- compensation runs after partial failure
- dead-letter record is created after unrecoverable failure
- audit ledger records execution events

## Acceptance Criteria

vijju's track is complete when:

- `npm test` passes.
- Demo still runs with `npm run demo`.
- `ActionGraph` can execute through registered connectors.
- Idempotency prevents duplicate execution.
- Failures produce clear receipts.
- Audit ledger records key execution events.
- Connector registry is documented.

## Final Deliverable

A safe local execution framework:

```text
typed action graph -> connector validation -> execution -> receipt -> audit record
```

## Out Of Scope

Do not build:

- Event/context/policy logic.
- UI screens.
- AI recommendations.
- Real enterprise credentials.
- Real external API calls.

Those belong to other tracks or later phases.
