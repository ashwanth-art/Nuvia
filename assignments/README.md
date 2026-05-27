# Team Assignments

This folder divides Nuvia work among three people:

- Ashwanth Reddy
- vijju
- chaitanya

The goal is equal and parallel work. Each person owns a separate track with clear inputs and outputs.

## Parallel Work Rule

No person should wait for another person to start. Use the sample contracts in `examples/fixtures` as mock input and output.

Integration can happen later after each track has its first working version.

## Shared Contract Files

Everyone should align with:

- `docs/VISION.md`
- `docs/MVP_SCOPE.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISION_CONTRACTS.md`
- `examples/fixtures/checkout-event.sample.json`
- `examples/fixtures/decision-request.sample.json`
- `examples/fixtures/action-graph.sample.json`
- `examples/fixtures/execution-receipt.sample.json`

## Assignment Summary

| Person | Track | Independent Output |
| --- | --- | --- |
| Ashwanth Reddy | Decision Core and Governance | Event validation, context assembly, policy checks, action compiler, shared schemas |
| vijju | Execution, Connectors, Audit | Connector registry, execution state machine, idempotency, retry, receipts, audit ledger |
| chaitanya | Control Room, Agents, Evaluation | Dashboard data, approval queue, agent explanations, simulation, evaluation views |

## Detailed Assignment Files

- `assignments/Ashwanth_Reddy.md` contains the full plan for decision contracts, event ingress, context assembly, policy service, and action compiler.
- `assignments/vijju.md` contains the full plan for execution, connectors, idempotency, retry, compensation, audit, and observability.
- `assignments/chaitanya.md` contains the full plan for Control Room, approval workflow, agent assist, simulation, and evaluation.

Each detailed file includes exact files to edit, suggested function names, tests to add, acceptance criteria, and out-of-scope boundaries.

## Integration Plan

1. Each person builds against fixture data first.
2. Each person documents their API/input/output.
3. Weekly integration merges the outputs.
4. Conflicts are resolved by updating shared contracts, not by changing hidden logic.
