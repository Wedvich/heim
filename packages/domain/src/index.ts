export { buildAggregate, type Aggregate, type ApplyFn } from "./aggregate.ts";
export { AGGREGATE_REGISTRY, type AggregateConfig } from "./aggregate-registry.ts";
export {
  CommandHandlerRegistry,
  type Command,
  type CommandHandler,
  type CommandResult,
  type DecisionEvent,
  type DecisionResult,
  type FollowUpIntent,
} from "./commands.ts";
export type {
  DomainEvent,
  MemberAddedEvent,
  MemberAddedPayload,
  MemberRemovedEvent,
  MemberRemovedPayload,
  TenantCreatedEvent,
  TenantCreatedPayload,
  TenantEvent,
  TenantRenamedEvent,
  TenantRenamedPayload,
  UserCreatedEvent,
  UserCreatedPayload,
  UserEvent,
} from "./events.ts";
export type { UserCreatedPii } from "./forgettable-payloads.ts";
export type { HydratedUserCreatedEvent, HydratedUserEvent } from "./hydrated-events.ts";
export {
  applyInventoryItemEvent,
  applyProductTypeEvent,
  INITIAL_INVENTORY_ITEM_STATE,
  INITIAL_PRODUCT_TYPE_STATE,
  inventoryItemHandler,
  INVENTORY_ITEM_LEVELS,
  productTypeHandler,
} from "./inventory/index.ts";
export type {
  AddInventoryItemPayload,
  ConsumeInventoryItemPayload,
  CorrectInventoryItemLevelPayload,
  CreateProductTypePayload,
  InventoryItemAddedEvent,
  InventoryItemAddedPayload,
  InventoryItemCommand,
  InventoryItemCommandPayload,
  InventoryItemConsumedEvent,
  InventoryItemConsumedPayload,
  InventoryItemDiscardedEvent,
  InventoryItemEvent,
  InventoryItemLevel,
  InventoryItemLevelCorrectedEvent,
  InventoryItemLevelCorrectedPayload,
  InventoryItemState,
  ProductTypeCommand,
  ProductTypeCommandPayload,
  ProductTypeCreatedEvent,
  ProductTypeCreatedPayload,
  ProductTypeEvent,
  ProductTypeState,
  ProductTypeUpdatedEvent,
  ProductTypeUpdatedPayload,
  UpdateProductTypePayload,
} from "./inventory/index.ts";
export {
  applyTenantEvent,
  INITIAL_TENANT_STATE,
  tenantHandler,
  type RenameTenantPayload,
  type TenantCommand,
  type TenantCommandPayload,
  type TenantMember,
  type TenantState,
} from "./tenant/index.ts";
export { applyUserEvent, INITIAL_USER_STATE, type UserState } from "./user/index.ts";
