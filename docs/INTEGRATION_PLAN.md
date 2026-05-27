# Integration Plan

Nuvia integrates into existing enterprise systems. The company should not replace POS, CRM, loyalty, fraud, marketing, or finance systems.

## Integration Direction

Enterprise systems send events to Nuvia. Nuvia sends approved actions back through controlled connectors.

## Inbound Integrations

- POS checkout events.
- Ecommerce checkout events.
- Loyalty earning and redemption events.
- CRM customer profile changes.
- Inventory updates.
- Pricing and margin updates.
- Fraud signals.
- Support events.
- Partner transactions.

## Outbound Integrations

- Loyalty core actions.
- POS or commerce actions.
- Fraud case creation.
- Step-up verification request.
- Notification send request.
- Marketing automation update.
- Audit export.
- Data warehouse export.

## Connector Safety

Each connector must have:

- Connector ID.
- Operation allowlist.
- Tenant-scoped credentials.
- Request schema.
- Response schema.
- Rate limits.
- Timeout budget.
- Retry policy.
- Error taxonomy.
- Compensation support.
- Owner.

## First Connectors

1. Loyalty Core.
2. POS or Commerce Platform.
3. Fraud Platform.
4. Notification Service.
5. Data Warehouse.
