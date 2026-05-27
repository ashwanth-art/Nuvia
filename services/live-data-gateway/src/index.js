import { createEventIngress } from "../../event-ingress/src/index.js";

const SENSITIVE_CUSTOMER_FIELDS = ["email", "phone", "address", "full_name", "government_id"];
const SENSITIVE_PAYMENT_FIELDS = ["card_number", "cvv", "payment_token", "account_number"];
const SUPPORTED_EVENT_TYPES = new Set(["checkout.started", "loyalty.redemption.requested"]);

export function createLiveDataGateway({ ingress = createEventIngress() } = {}) {
  return {
    ingestBatch(events) {
      if (!Array.isArray(events)) {
        throw new LiveDataGatewayError("Live data batch must be an array");
      }

      const accepted = [];
      const rejected = [];

      for (const event of events) {
        const normalized = normalizeLiveEvent(event);

        if (!normalized.ok) {
          rejected.push(normalized.rejection);
          continue;
        }

        try {
          const ingressResult = ingress.ingestCheckoutEvent(normalized.event);

          if (ingressResult.status === "accepted") {
            accepted.push({
              event_id: ingressResult.event_id,
              event: ingressResult.event
            });
          } else {
            rejected.push({
              event_id: ingressResult.event_id,
              reason: ingressResult.reason
            });
          }
        } catch (error) {
          rejected.push({
            event_id: normalized.event.event_id ?? "unknown",
            reason: "SCHEMA_VALIDATION_FAILED",
            message: error.message
          });
        }
      }

      return {
        accepted_count: accepted.length,
        rejected_count: rejected.length,
        accepted,
        rejected
      };
    }
  };
}

export function normalizeLiveEvent(rawEvent) {
  if (!rawEvent || typeof rawEvent !== "object" || Array.isArray(rawEvent)) {
    return reject("unknown", "EVENT_MUST_BE_OBJECT");
  }

  if (!rawEvent.tenant_id) {
    return reject(rawEvent.event_id, "MISSING_TENANT");
  }

  if (!SUPPORTED_EVENT_TYPES.has(rawEvent.event_type)) {
    return reject(rawEvent.event_id, "UNSUPPORTED_EVENT_TYPE");
  }

  if (!rawEvent.customer?.customer_id) {
    return reject(rawEvent.event_id, "MISSING_CUSTOMER");
  }

  if (!rawEvent.basket?.basket_id || !Array.isArray(rawEvent.basket.items)) {
    return reject(rawEvent.event_id, "MALFORMED_BASKET");
  }

  const sanitized = deepClone(rawEvent);
  redactSensitiveFields(sanitized);

  return {
    ok: true,
    event: sanitized
  };
}

export function containsSensitiveFields(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const keys = Object.keys(value);
  const hasSensitiveKey = keys.some((key) => {
    const normalizedKey = key.toLowerCase();
    return SENSITIVE_CUSTOMER_FIELDS.includes(normalizedKey) || SENSITIVE_PAYMENT_FIELDS.includes(normalizedKey);
  });

  if (hasSensitiveKey) {
    return true;
  }

  return Object.values(value).some((child) => containsSensitiveFields(child));
}

export class LiveDataGatewayError extends Error {
  constructor(message) {
    super(message);
    this.name = "LiveDataGatewayError";
  }
}

function redactSensitiveFields(value) {
  if (!value || typeof value !== "object") {
    return;
  }

  for (const key of Object.keys(value)) {
    const normalizedKey = key.toLowerCase();

    if (SENSITIVE_CUSTOMER_FIELDS.includes(normalizedKey) || SENSITIVE_PAYMENT_FIELDS.includes(normalizedKey)) {
      delete value[key];
      continue;
    }

    redactSensitiveFields(value[key]);
  }
}

function reject(eventId, reason) {
  return {
    ok: false,
    rejection: {
      event_id: eventId ?? "unknown",
      reason
    }
  };
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
