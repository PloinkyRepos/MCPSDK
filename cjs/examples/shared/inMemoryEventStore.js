"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
class InMemoryEventStore {
  constructor() {
    this.events = /* @__PURE__ */ new Map();
  }
  /**
   * Generates a unique event ID for a given stream ID
   */
  generateEventId(streamId) {
    return `${streamId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
  /**
   * Extracts the stream ID from an event ID
   */
  getStreamIdFromEventId(eventId) {
    const parts = eventId.split("_");
    return parts.length > 0 ? parts[0] : "";
  }
  /**
   * Stores an event with a generated event ID
   * Implements EventStore.storeEvent
   */
  async storeEvent(streamId, message) {
    const eventId = this.generateEventId(streamId);
    this.events.set(eventId, { streamId, message });
    return eventId;
  }
  /**
   * Replays events that occurred after a specific event ID
   * Implements EventStore.replayEventsAfter
   */
  async replayEventsAfter(lastEventId, { send }) {
    if (!lastEventId || !this.events.has(lastEventId)) {
      return "";
    }
    const streamId = this.getStreamIdFromEventId(lastEventId);
    if (!streamId) {
      return "";
    }
    let foundLastEvent = false;
    const sortedEvents = [...this.events.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [eventId, { streamId: eventStreamId, message }] of sortedEvents) {
      if (eventStreamId !== streamId) {
        continue;
      }
      if (eventId === lastEventId) {
        foundLastEvent = true;
        continue;
      }
      if (foundLastEvent) {
        await send(eventId, message);
      }
    }
    return streamId;
  }
}
exports.InMemoryEventStore = InMemoryEventStore;
//# sourceMappingURL=inMemoryEventStore.js.map
