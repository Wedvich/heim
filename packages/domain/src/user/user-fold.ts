import type { HydratedUserEvent } from "../hydrated-events.ts";
import type { UserState } from "./user-state.ts";

export function applyUserEvent(state: UserState, event: HydratedUserEvent): UserState {
  switch (event.eventType) {
    case "UserCreated":
      return {
        ...state,
        principalId: event.streamId,
        createdAt: event.actualTime,
        provider: event.payload.provider,
        displayName: event.pii?.name,
        email: event.pii?.email,
        avatarUrl: event.pii?.avatarUrl,
      };
  }
}
