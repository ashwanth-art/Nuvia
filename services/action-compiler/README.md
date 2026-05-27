# Action Compiler

Converts candidate decision plans into typed action graphs.

Responsibilities:

- Validate action type.
- Validate connector ID.
- Validate parameters.
- Require policy references.
- Require idempotency key.
- Require rollback strategy where needed.
- Reject unsafe or unknown actions.
