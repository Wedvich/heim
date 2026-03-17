import type { UserCreatedEvent } from "./events.ts";
import type { UserCreatedPii } from "./forgettable-payloads.ts";

export interface HydratedUserCreatedEvent extends UserCreatedEvent {
  readonly pii?: UserCreatedPii;
}

export type HydratedUserEvent = HydratedUserCreatedEvent;
