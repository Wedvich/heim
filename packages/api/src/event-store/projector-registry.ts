import type { PoolClient } from "pg";
import type { DomainEvent } from "@heim/domain";

export type EventProjector = (client: PoolClient, event: DomainEvent) => Promise<void>;

export class ProjectorRegistry {
  #projectors = new Map<string, EventProjector>();

  register(streamType: string, eventType: string, projector: EventProjector): this {
    const key = `${streamType}:${eventType}`;
    if (this.#projectors.has(key)) {
      throw new Error(`Projector already registered for ${key}`);
    }
    this.#projectors.set(key, projector);
    return this;
  }

  async apply(client: PoolClient, events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      const key = `${event.streamType}:${event.eventType}`;
      const projector = this.#projectors.get(key);
      if (projector) {
        await projector(client, event);
      }
    }
  }
}
