export { buildAggregate, type Aggregate, type ApplyFn } from "./aggregate.ts";
export { AGGREGATE_REGISTRY, type AggregateConfig } from "./aggregate-registry.ts";
export type {
  DomainEvent,
  TenantCreatedEvent,
  TenantCreatedPayload,
  TenantEvent,
  UserCreatedEvent,
  UserCreatedPayload,
  UserEvent,
} from "./events.ts";
export type { UserCreatedPii } from "./forgettable-payloads.ts";
export type { HydratedUserCreatedEvent, HydratedUserEvent } from "./hydrated-events.ts";
export { applyTenantEvent, INITIAL_TENANT_STATE, type TenantState } from "./tenant/index.ts";
export { applyUserEvent, INITIAL_USER_STATE, type UserState } from "./user/index.ts";
