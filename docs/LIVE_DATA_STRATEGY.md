# Live Data Strategy

Nuvia can use live data, but it must use live data carefully.

## Main Rule

Never connect raw production data directly to agent logic.

Live data must pass through:

```text
source system -> live data gateway -> sanitization -> schema validation -> event ingress -> context assembly
```

## Live Data Sources

Possible future sources:

- POS checkout events.
- Ecommerce checkout events.
- Loyalty earn/redemption events.
- CRM profile updates.
- Fraud risk signals.
- Inventory updates.
- Pricing and margin updates.
- Campaign events.
- Support events.

## First Live Data Source

Start with:

**Read-only checkout and loyalty redemption events from a sandbox or exported dataset.**

This is the safest useful first source.

## Data Safety Rules

Allowed:

- Tenant ID.
- Event ID.
- Event type.
- Event time.
- Store or channel ID.
- Customer ID or hashed customer ID.
- Loyalty ID or hashed loyalty ID.
- Basket ID.
- SKU.
- Quantity.
- Price.
- Margin percent.
- Fraud score.
- Consent profile ID.

Not allowed in early phases:

- Raw card number.
- CVV.
- Full payment token.
- Passwords.
- API secrets.
- Raw email.
- Raw phone.
- Full address.
- Government IDs.
- Free-form sensitive notes.

## Live Data Gateway Responsibilities

The gateway should:

- Accept event batches.
- Reject unsupported event types.
- Remove sensitive fields.
- Normalize required fields.
- Validate schema.
- Report accepted and rejected events.
- Preserve rejection reasons.
- Produce events ready for `event-ingress`.

## Live Data Testing

Every live-data connector must have tests for:

- valid event accepted.
- missing tenant rejected.
- missing customer rejected.
- unsupported event type rejected.
- duplicate event detected.
- sensitive fields redacted.
- malformed basket rejected.
- large batch handled.
- partial batch success.
- no raw secret appears in output.

## Production Readiness Checklist

Before production live data:

- Data Processing Agreement is reviewed.
- PII map is documented.
- Tenant isolation is tested.
- Audit logging is enabled.
- Secrets are stored outside code.
- Connector credentials are scoped.
- Replay protection is enabled.
- Data retention rules are defined.
- Monitoring dashboard exists.
- Kill switch exists.
