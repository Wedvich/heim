import type { ApplyFn } from "./aggregate.ts";
import type { DomainEvent } from "./events.ts";
import { applyProductTypeEvent } from "./inventory/product-type-fold.ts";
import { INITIAL_PRODUCT_TYPE_STATE } from "./inventory/product-type-state.ts";
import { applyStockItemEvent } from "./inventory/stock-item-fold.ts";
import { INITIAL_STOCK_ITEM_STATE } from "./inventory/stock-item-state.ts";
import { applyTenantEvent } from "./tenant/tenant-fold.ts";
import { INITIAL_TENANT_STATE } from "./tenant/tenant-state.ts";
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
  StockItem: {
    initial: INITIAL_STOCK_ITEM_STATE,
    apply: applyStockItemEvent as ApplyFn<unknown, DomainEvent>,
  },
  Tenant: {
    initial: INITIAL_TENANT_STATE,
    apply: applyTenantEvent as ApplyFn<unknown, DomainEvent>,
  },
  User: { initial: INITIAL_USER_STATE, apply: applyUserEvent as ApplyFn<unknown, DomainEvent> },
};
