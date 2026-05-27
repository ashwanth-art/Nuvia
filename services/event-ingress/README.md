# Event Ingress Service

Receives enterprise events and prepares them for Nuvia.

Responsibilities:

- Authenticate event source.
- Validate event schema.
- Resolve tenant.
- Check replay protection.
- Deduplicate events.
- Tag PII.
- Send valid events to the event stream.
