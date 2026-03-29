import type { ApplyFn } from "./aggregate.ts";
import type { DomainEvent } from "./events.ts";
import { applyProductTypeEvent } from "./inventory/product-type-fold.ts";
import { INITIAL_PRODUCT_TYPE_STATE } from "./inventory/product-type-state.ts";
import { applyInventoryItemEvent } from "./inventory/inventory-item-fold.ts";
import { INITIAL_INVENTORY_ITEM_STATE } from "./inventory/inventory-item-state.ts";
import { applyTenantEvent } from "./tenant/tenant-fold.ts";
import { INITIAL_TENANT_STATE } from "./tenant/tenant-state.ts";
import { applyRoomEvent } from "./room/room-fold.ts";
import { INITIAL_ROOM_STATE } from "./room/room-state.ts";
import { applyUserEvent } from "./user/user-fold.ts";
import { INITIAL_USER_STATE } from "./user/user-state.ts";

export interface AggregateConfig<TState = unknown, TEvent extends DomainEvent = DomainEvent> {
  readonly initial: TState;
  readonly apply: ApplyFn<TState, TEvent>;
}

export const AGGREGATE_REGISTRY: Readonly<Record<string, AggregateConfig>> = {
  ProductType: {
    initial: INITIAL_PRODUCT_TYPE_STATE,
    apply: applyProductTypeEvent as ApplyFn<unknown, DomainEvent>,
  },
  InventoryItem: {
    initial: INITIAL_INVENTORY_ITEM_STATE,
    apply: applyInventoryItemEvent as ApplyFn<unknown, DomainEvent>,
  },
  Room: {
    initial: INITIAL_ROOM_STATE,
    apply: applyRoomEvent as ApplyFn<unknown, DomainEvent>,
  },
  Tenant: {
    initial: INITIAL_TENANT_STATE,
    apply: applyTenantEvent as ApplyFn<unknown, DomainEvent>,
  },
  User: { initial: INITIAL_USER_STATE, apply: applyUserEvent as ApplyFn<unknown, DomainEvent> },
};
