# Local MVP Completion

This project is complete as a local MVP, excluding deployment.

## Completed Backend

Flask backend:

- `backend/app.py`
- `backend/nuvia_core.py`
- `backend/store.py`

Capabilities:

- Scenario decision API.
- Live data ingestion API.
- PII redaction before decisioning.
- Local SQLite persistence.
- Stored decision history.
- Approval queue.
- Approve, reject, and escalate actions.
- Policy list and policy threshold update.
- Connector health list and health update.
- Simulation runs.
- Audit ledger query.
- Test matrix API.
- Team progress API.

## Completed Frontend

React frontend:

- `apps/control-room/static/index.html`
- `apps/control-room/static/app.js`
- `apps/control-room/static/styles.css`

Views:

- Decision Workbench.
- Decision detail.
- Approval queue.
- Live Data gateway tester.
- Policy Center.
- Connector Health.
- Simulation Lab.
- Audit Explorer.
- Test Matrix.
- Team Progress.

## Completed Team Tracks

### Ashwanth Reddy

Completed:

- Event validation.
- Context assembly.
- Policy checks.
- Decision contracts.
- Action compiler.
- Policy Center API.
- Local policy persistence.

### vijju

Completed:

- Live data gateway.
- Connector registry.
- Execution receipts.
- Audit ledger.
- SQLite persistence.
- Connector health API.
- Approval execution update.

### chaitanya

Completed:

- React Control Room.
- Scenario runner.
- Approval UI.
- Policy Center UI.
- Connector Health UI.
- Simulation UI.
- Audit UI.
- Test Matrix UI.
- Team Progress UI.

## Live Data Used

Current live data mode:

```text
demo_sandbox_live_like_data
```

This is not real production customer data. It is safe checkout-like data for manual testing.

Used fields:

- tenant ID
- event ID
- event type
- event time
- POS source
- store/location ID
- terminal ID
- customer ID
- loyalty ID
- consent profile ID
- basket ID
- SKU
- quantity
- unit price
- margin percent
- fraud risk score by scenario

Redacted fields:

- email
- phone
- address
- full name
- government ID
- card number
- CVV
- payment token
- account number

## Not Included

Deployment is intentionally excluded.

Production-only items still not included:

- Cloud deployment.
- Real enterprise credentials.
- Real POS/CRM/loyalty/fraud APIs.
- Production SSO.
- Production observability stack.
- SOC 2/ISO evidence.

Those need a real customer environment and deployment target.
