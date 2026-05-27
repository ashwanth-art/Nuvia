# Decision Contracts

Nuvia should be built around strict contracts. Contracts make the system safe, testable, and auditable.

## DecisionRequest

A structured request created after event ingress and context assembly.

Required fields:

- `request_id`
- `tenant_id`
- `event_type`
- `event_time`
- `actor`
- `subject`
- `decision_domain`
- `latency_budget_ms`
- `risk_tier`
- `context_refs`
- `policy_bundle_ref`

## DecisionPlan

The result of deterministic logic or agent-assisted reasoning.

Required fields:

- `decision_id`
- `request_id`
- `summary`
- `evidence`
- `risk_score`
- `expected_impact`
- `candidate_actions`
- `requires_approval`
- `model_version`
- `policy_version`

## ActionGraph

A typed action plan that can be validated and executed.

Required fields:

- `action_graph_id`
- `decision_id`
- `idempotency_key`
- `actions`
- `policy_refs`
- `approval_status`
- `rollback_strategy`

## ExecutionReceipt

Proof of what happened during execution.

Required fields:

- `receipt_id`
- `action_graph_id`
- `status`
- `started_at`
- `completed_at`
- `actions`
- `connector_results`
- `audit_ref`

## DecisionContextPack

The inspectable record of a decision.

It should include:

- Request context hash.
- Context admitted.
- Context rejected.
- Context missing.
- Policy versions.
- Evidence references.
- Agent reasoning summary.
- Candidate action graph.
- Final action graph.
- Approval trail.
- Execution receipt.
- Outcome metrics.

## Contract Rule

Agents may only produce structured outputs. Any action-bearing output must pass schema validation, policy enforcement, and action compilation before execution.
