import { makeStableId, validateCheckoutEvent } from "../../../packages/schemas/src/index.js";

export function createEventIngress({ now = () => new Date() } = {}) {
  const seenEventIds = new Set();

  return {
    ingestCheckoutEvent(event) {
      validateCheckoutEvent(event);

      const eventId = event.event_id ?? makeStableId("evt", event);

      if (seenEventIds.has(eventId)) {
        return {
          status: "duplicate",
          event_id: eventId,
          reason: "EVENT_ALREADY_INGESTED"
        };
      }

      seenEventIds.add(eventId);

      return {
        status: "accepted",
        event_id: eventId,
        received_at: now().toISOString(),
        event: {
          ...event,
          event_id: eventId,
          ingestion_id: makeStableId("ing", {
            event_id: eventId,
            received_at: now().toISOString()
          })
        }
      };
    }
  };
}
