# Complete Project Delivery Plan

Nuvia should be built in controlled phases. The product is too important to build as one large untested block.

## Final Goal

Build an enterprise decision orchestration platform that can use live business data safely.

The complete system should:

- Receive live events from enterprise systems.
- Sanitize and validate data before using it.
- Assemble decision context.
- Evaluate policies.
- Create decision plans.
- Compile safe action graphs.
- Route risky actions to approval.
- Execute approved actions through connectors.
- Record every step in an audit ledger.
- Show operators the state of the system.
- Run many automated tests before every release.

## Delivery Phases

### Phase 1: Local Deterministic Core

Purpose:

- Prove the decision pipeline works without live systems.

Build:

- Event ingress.
- Context assembly.
- Policy service.
- Decision plan generation.
- Action compiler.
- Execution OS mock.
- Audit ledger mock.
- Control Room snapshot.
- Automated tests.

Current status:

- Starter code exists.
- Demo exists.
- Tests exist and should keep expanding.

### Phase 2: Live Data Gateway

Purpose:

- Start accepting live-like data safely without connecting directly to production systems.

Build:

- Live data gateway.
- Field sanitization.
- PII redaction.
- Batch ingestion.
- Rejection reports.
- Live data fixtures.
- Contract tests.

Important:

- No raw payment data.
- No raw secrets.
- No direct production writes.
- Read-only or sandbox feeds first.

### Phase 3: Persistence and APIs

Purpose:

- Move from in-memory demo modules to real service boundaries.

Build:

- API endpoints.
- Database persistence.
- Audit storage.
- Idempotency storage.
- Connector registry storage.
- Environment config.
- Integration test setup.

### Phase 4: Control Room Web App

Purpose:

- Give operators visibility and approval controls.

Build:

- Live Decisions.
- Approval Queue.
- Decision Detail.
- Audit Explorer.
- Connector Health.
- Simulation Lab.
- Incident Center.

### Phase 5: Real Connectors

Purpose:

- Integrate with selected enterprise systems.

Build:

- Loyalty connector.
- POS or commerce connector.
- Fraud connector.
- Notification connector.
- Data warehouse export.

Start with sandbox credentials and test tenants only.

### Phase 6: Agent Assist

Purpose:

- Add AI recommendation and explanation safely.

Build:

- Model gateway.
- Agent orchestrator.
- Loyalty Strategist recommendation.
- Fraud Sentinel recommendation.
- Margin Guardian recommendation.
- Explanation validation.
- Offline evaluation suite.

Rule:

- Agents recommend. Policies authorize. Compiler validates. Execution OS acts.

### Phase 7: Bounded Autonomy

Purpose:

- Allow low-risk automatic actions under strict policy.

Build:

- Autonomy levels.
- Human approval thresholds.
- Kill switches.
- Canary rollout.
- Simulation before launch.
- Incident rollback.

## Live Data Milestones

1. Use sample fixture data.
2. Use exported historical data with all PII removed.
3. Use sandbox API data.
4. Use live read-only event feed.
5. Use live write actions only in sandbox.
6. Use production actions only after approval, audit, rollback, and monitoring are ready.

## Testing Milestones

1. Unit tests for each module.
2. Contract tests for every schema.
3. Integration tests for the full pipeline.
4. Policy tests for allow/review/block.
5. Connector tests for success/failure/retry.
6. Audit tests for traceability.
7. Load tests for checkout latency.
8. Security tests for PII and tenant isolation.
9. Regression tests using historical incidents.
10. End-to-end tests before production.

## Definition Of Complete

The project is complete only when:

- Live data can be ingested safely.
- Sensitive fields are redacted.
- Every decision has policy evidence.
- Every execution has a receipt.
- Every action is auditable.
- Tests cover normal, risky, failed, duplicate, and invalid scenarios.
- Operators can see decisions and approvals.
- No AI path can bypass policy or execution controls.
