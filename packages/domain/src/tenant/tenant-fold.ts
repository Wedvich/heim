import type { TenantEvent } from "../events.ts";
import type { TenantState } from "./tenant-state.ts";

export function applyTenantEvent(state: TenantState, event: TenantEvent): TenantState {
  switch (event.eventType) {
    case "TenantCreated":
      return {
        ...state,
        tenantId: event.streamId,
        name: event.payload.name,
        slug: event.payload.slug,
        createdAt: event.actualTime,
      };
    case "MemberAdded": {
      return {
        ...state,
        members: {
          ...state.members,
          [event.payload.principalId]: {
            role: event.payload.role,
            joinedAt: event.actualTime,
          },
        },
      };
    }
    case "MemberRemoved": {
      const { [event.payload.principalId]: _, ...rest } = state.members;
      return { ...state, members: rest };
    }
    case "TenantRenamed":
      return { ...state, name: event.payload.newName };
  }
}
