# Assignment: chaitanya

## Track

Control Room, Agent Assist, Simulation, and Evaluation.

## Mission

Build the operator-facing and AI-assist side of Nuvia. This track can work using mock data and does not need the backend to be finished first.

This work should make Nuvia understandable to business users:

- What decisions are happening live?
- Which decisions need approval?
- Why was something approved or blocked?
- What did the agent recommend?
- What is the business impact?
- Is the system healthy?

## Independent Inputs

Use these files as input:

- `examples/fixtures/decision-request.sample.json`
- `examples/fixtures/action-graph.sample.json`
- `examples/fixtures/execution-receipt.sample.json`

You do not need to wait for production services. Build with mock API responses first.

## Deliverables

1. Design the Control Room screens:
   - Live Decisions
   - Approval Queue
   - Audit Explorer
   - Policy Center
   - Fraud Watch
   - Margin Monitor
   - Connector Health
   - Incident Center

2. Create the approval workflow:
   - View decision summary
   - View evidence
   - View policy checks
   - Approve
   - Reject
   - Escalate
   - Add reviewer note

3. Design the agent assist flow:
   - Loyalty Strategist recommendation
   - Fraud Sentinel recommendation
   - Margin Guardian warning
   - Explanation summary
   - Confidence and uncertainty display

4. Design the Simulation Lab concept:
   - Run policy against sample checkout events
   - Show expected margin impact
   - Show fraud risk impact
   - Show customer impact
   - Show safe-to-launch or needs-review result

5. Define evaluation views:
   - Policy compliance test result
   - Schema adherence test result
   - Fraud false positive tracking
   - Agent explanation quality
   - Latency and cost display

6. Prepare UI data contracts:
   - Decision list item
   - Decision detail
   - Approval queue item
   - Audit timeline event
   - Connector health card
   - Simulation result

## Suggested Folder Ownership

- `apps/control-room`
- `services/agent-orchestrator`
- `packages/evaluation`
- `docs/ARCHITECTURE.md`
- `docs/MVP_SCOPE.md`

## Output Expected

By the end of this track, the project should clearly show how business users will monitor, review, approve, and understand Nuvia decisions.

## Done Means

- Control Room screen list and flows are documented.
- Mock decision and approval data is defined.
- Agent assist behavior is explained.
- Simulation and evaluation concepts are clear.
