# Assignment: chaitanya

## Track

Control Room, Agent Assist, Simulation, and Evaluation.

## One-Line Responsibility

chaitanya owns the part of Nuvia that business users see and understand: live decisions, approvals, explanations, simulations, and evaluation health.

## Product Area

This track is the operator experience and AI-assist layer of Nuvia.

It answers:

- What is happening right now?
- Which decisions need approval?
- Why did Nuvia recommend or block something?
- What evidence and policies were used?
- What did the agent suggest?
- What is the business impact?
- Is the system safe and healthy?

## Independent Working Rule

This work should not wait for backend services to be production-ready.

Use mock data and fixtures:

- `examples/fixtures/decision-request.sample.json`
- `examples/fixtures/action-graph.sample.json`
- `examples/fixtures/execution-receipt.sample.json`
- generated audit records from `examples/run-phase1-demo.mjs`

As long as mock objects exist, chaitanya can build UI data contracts and flows independently.

## Main Files Owned

- `apps/control-room/src/dashboard.js`
- `services/agent-orchestrator/src/index.js`
- `packages/evaluation/src/index.js`
- `examples/run-phase1-demo.mjs`
- `docs/ARCHITECTURE.md`
- `docs/MVP_SCOPE.md`
- UI-facing data contract docs added later

## Current Starter Code

The repo already contains starter functions:

- `buildControlRoomSnapshot`
- `formatControlRoomSnapshot`
- `createDecisionPlan`
- `evaluatePhase1Run`

chaitanya should improve these into a stronger operator and agent-assist foundation.

## Detailed Tasks

### 1. Expand Control Room Snapshot

File:

- `apps/control-room/src/dashboard.js`

Work:

- Expand `buildControlRoomSnapshot`.
- Add dashboard sections:
  - live decisions
  - approval queue count
  - blocked decisions count
  - completed executions count
  - failed executions count
  - connector health
  - policy block rate
  - fraud review count
  - margin review count
  - latest incidents
- Add helper functions:
  - `buildLiveDecisionList`
  - `buildApprovalQueue`
  - `buildAuditTimeline`
  - `buildConnectorHealthCards`
  - `buildPolicySummary`

Expected output:

- Mock dashboard object can feed a future frontend.

### 2. Define UI Data Contracts

Create or update a docs file later, for example:

- `docs/UI_CONTRACTS.md`

Work:

- Define UI objects:
  - `DecisionListItem`
  - `DecisionDetail`
  - `ApprovalQueueItem`
  - `AuditTimelineEvent`
  - `AgentRecommendation`
  - `PolicyCheckView`
  - `ConnectorHealthCard`
  - `SimulationResult`
  - `EvaluationResult`
- For each object, define:
  - field name
  - type
  - description
  - example value

Expected output:

- UI work can start without guessing backend shapes.

### 3. Expand Agent Assist Logic

File:

- `services/agent-orchestrator/src/index.js`

Work:

- Keep deterministic Phase 1 logic, but structure it as agent-style recommendations.
- Add recommendation builders:
  - `buildLoyaltyStrategistRecommendation`
  - `buildFraudSentinelRecommendation`
  - `buildMarginGuardianRecommendation`
- Each recommendation should include:
  - agent name
  - recommendation
  - confidence
  - evidence refs
  - policy refs
  - risk note
  - suggested action
  - approval requirement
- Add explanation summary:
  - simple business wording
  - why Nuvia chose action
  - what could go wrong
  - why human approval is or is not needed

Expected output:

- Business users can understand the agent recommendation.

### 4. Build Approval Workflow Model

File:

- `apps/control-room/src/dashboard.js`

Work:

- Add approval queue shape:
  - approval ID
  - request ID
  - decision ID
  - risk tier
  - reason
  - policy refs
  - recommended action
  - reviewer status
  - created time
  - SLA target
- Add possible approval actions:
  - approve
  - reject
  - escalate
  - request more evidence
- Add mock reducer or helper:
  - `applyApprovalDecision(queueItem, decision)`

Expected output:

- Team can model approval behavior before building full UI.

### 5. Expand Evaluation Harness

File:

- `packages/evaluation/src/index.js`

Work:

- Expand `evaluatePhase1Run`.
- Add evaluation categories:
  - schema adherence
  - policy compliance
  - action graph safety
  - explanation quality
  - approval correctness
  - latency placeholder
  - audit completeness
- Each check should return:
  - name
  - passed
  - severity
  - message
  - related artifact ID

Expected output:

- Evaluation result can be shown in Control Room.

### 6. Add Simulation Lab Starter

File options:

- `packages/evaluation/src/index.js`
- or new file `apps/control-room/src/simulation.js`

Work:

- Add simulation function:
  - input: checkout event plus policy overrides
  - output: expected decision, expected action, risk, margin impact, approval need
- Add use cases:
  - safe offer
  - low margin review
  - high fraud block
  - consent missing block
- Return result fields:
  - simulation ID
  - scenario name
  - policy decision
  - expected action type
  - estimated business impact
  - safety result
  - explanation

Expected output:

- Operators can preview what a policy would do before production.

### 7. Improve Demo Output

File:

- `examples/run-phase1-demo.mjs`

Work:

- Print more useful business output:
  - event received
  - decision request ID
  - policy decision
  - policy checks
  - agent recommendation
  - action graph
  - execution receipt
  - audit event count
  - dashboard snapshot
  - evaluation result
- Keep output readable for demos.

Expected output:

- Team can run `npm run demo` and understand Nuvia end to end.

### 8. Prepare Future Frontend Plan

Files:

- `docs/MVP_SCOPE.md`
- `docs/ARCHITECTURE.md`

Work:

- Add Control Room MVP screens:
  - Live Decisions
  - Approval Queue
  - Decision Detail
  - Audit Explorer
  - Policy Summary
  - Connector Health
  - Simulation Lab
- For each screen, document:
  - purpose
  - primary user
  - required data
  - primary actions
  - empty state
  - error state

Expected output:

- Frontend implementation can begin cleanly later.

## Suggested Implementation Order

1. Expand Control Room snapshot.
2. Define UI data contracts.
3. Improve agent recommendation shape.
4. Add approval workflow model.
5. Expand evaluation harness.
6. Add simulation starter.
7. Improve demo output.
8. Update docs.

## Tests To Add

Add tests in:

- `tests/phase1.test.mjs`

Required tests:

- dashboard snapshot counts decisions correctly
- approval queue includes review-required decisions
- audit timeline is ordered
- evaluation passes for safe decision
- evaluation fails when receipt is missing
- agent recommendation includes evidence and policy refs
- simulation returns block for high fraud scenario
- simulation returns review for low margin scenario

## Acceptance Criteria

chaitanya's track is complete when:

- `npm test` passes.
- Demo still runs with `npm run demo`.
- Dashboard snapshot gives useful business summary.
- Approval queue model exists.
- Agent recommendation is understandable to non-technical users.
- Evaluation result has clear pass/fail checks.
- Simulation starter supports at least 4 scenarios.
- UI contract docs are clear enough for frontend implementation.

## Final Deliverable

A business-facing Phase 1 operator foundation:

```text
decision data -> agent explanation -> approval queue -> dashboard snapshot -> evaluation result
```

## Out Of Scope

Do not build:

- Event ingestion internals.
- Connector execution internals.
- Database persistence.
- Real production frontend framework unless assigned later.
- Real model provider integration.

Those belong to other tracks or later phases.
