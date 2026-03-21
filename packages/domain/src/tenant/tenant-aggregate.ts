import type { Aggregate } from "../aggregate.ts";
import { buildAggregate } from "../aggregate.ts";
import type { TenantEvent } from "../events.ts";
import { applyTenantEvent } from "./tenant-fold.ts";
import { INITIAL_TENANT_STATE, type TenantState } from "./tenant-state.ts";

export function buildTenantAggregate(events: readonly TenantEvent[]): Aggregate<TenantState> {
  return buildAggregate(INITIAL_TENANT_STATE, events, applyTenantEvent);
}
