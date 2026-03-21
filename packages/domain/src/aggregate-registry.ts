import type { ApplyFn } from "./aggregate.ts";
import type { DomainEvent } from "./events.ts";
import { applyTenantEvent } from "./tenant/tenant-fold.ts";
import { INITIAL_TENANT_STATE } from "./tenant/tenant-state.ts";
import { applyUserEvent } from "./user/user-fold.ts";
import { INITIAL_USER_STATE } from "./user/user-state.ts";

export interface AggregateConfig<TState = unknown, TEvent extends DomainEvent = DomainEvent> {
  readonly initial: TState;
  readonly apply: ApplyFn<TState, TEvent>;
}

export const AGGREGATE_REGISTRY: Readonly<Record<string, AggregateConfig>> = {
  Tenant: {
    initial: INITIAL_TENANT_STATE,
    apply: applyTenantEvent as ApplyFn<unknown, DomainEvent>,
  },
  User: { initial: INITIAL_USER_STATE, apply: applyUserEvent as ApplyFn<unknown, DomainEvent> },
};
