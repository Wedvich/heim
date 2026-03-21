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
  }
}
