# Assignment: vijju

## Track

Execution, Connectors, Audit, and Observability.

## Mission

Build the safe execution side of Nuvia. This track begins after a typed `ActionGraph` already exists, so it does not depend on the decision core or UI being finished.

This work should make Nuvia answer:

- Can this action be executed safely?
- Which connector should receive it?
- Was the action successful?
- What happens if it fails?
- How do we audit and replay the decision?

## Independent Inputs

Use these files as input:

- `examples/fixtures/action-graph.sample.json`
- `examples/fixtures/execution-receipt.sample.json`

You do not need to wait for context assembly, policies, agents, or UI.

## Deliverables

1. Design the Execution OS state machine:
   - Received
   - Validated
   - AwaitingApproval
   - Ready
   - Executing
   - Completed
   - Retrying
   - Failed
   - Compensating
   - DeadLetter

2. Create execution safety rules:
   - Idempotency keys
   - Retry limits
   - Timeout budgets
   - Compensation actions
   - Dead-letter queue behavior
   - Circuit breaker behavior

3. Define the connector registry:
   - Connector ID
   - Operation ID
   - Request schema
   - Response schema
   - Tenant credentials
   - Rate limits
   - Error taxonomy
   - Owner

4. Create first connector plans:
   - Loyalty core connector
   - POS or commerce connector
   - Fraud platform connector
   - Notification service connector
   - Data warehouse export connector

5. Define audit ledger events:
   - Decision received
   - Policy checked
   - Action graph compiled
   - Approval requested
   - Action executed
   - Execution failed
   - Compensation executed
   - Decision closed

6. Define observability outputs:
   - Request trace
   - Execution trace
   - Connector health metric
   - Dead-letter count
   - Retry count
   - SIEM export event

## Suggested Folder Ownership

- `services/execution-os`
- `services/audit-ledger`
- `packages/connectors`
- `infra`
- `docs/INTEGRATION_PLAN.md`

## Starter Code Files

- `services/execution-os/src/index.js`
- `services/audit-ledger/src/index.js`
- `packages/connectors/src/index.js`
- `infra/local-dev.env.example`

## Output Expected

By the end of this track, the project should clearly show how a typed action is executed safely and how Nuvia records proof of what happened.

## Done Means

- Sample `ActionGraph` can produce a sample `ExecutionReceipt`.
- Connector registry format is documented.
- Audit event names are defined.
- Retry, timeout, failure, and compensation rules are clear.
