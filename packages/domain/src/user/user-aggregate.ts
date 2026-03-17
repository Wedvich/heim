import { buildAggregate, type Aggregate } from "../aggregate.ts";
import type { HydratedUserEvent } from "../hydrated-events.ts";
import { applyUserEvent } from "./user-fold.ts";
import { INITIAL_USER_STATE, type UserState } from "./user-state.ts";

export function buildUserAggregate(events: readonly HydratedUserEvent[]): Aggregate<UserState> {
  return buildAggregate(INITIAL_USER_STATE, events, applyUserEvent);
}
