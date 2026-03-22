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
  applyProductTypeEvent,
  applyStockItemEvent,
  INITIAL_PRODUCT_TYPE_STATE,
  INITIAL_STOCK_ITEM_STATE,
  productTypeHandler,
  STOCK_ITEM_LEVELS,
  stockItemHandler,
} from "./inventory/index.ts";
export type {
  AddStockItemPayload,
  ConsumeStockItemPayload,
  CorrectStockItemLevelPayload,
  CreateProductTypePayload,
  ProductTypeCommand,
  ProductTypeCommandPayload,
  ProductTypeCreatedEvent,
  ProductTypeCreatedPayload,
  ProductTypeEvent,
  ProductTypeState,
  ProductTypeUpdatedEvent,
  ProductTypeUpdatedPayload,
  StockItemAddedEvent,
  StockItemAddedPayload,
  StockItemCommand,
  StockItemCommandPayload,
  StockItemConsumedEvent,
  StockItemConsumedPayload,
  StockItemDiscardedEvent,
  StockItemEvent,
  StockItemLevel,
  StockItemLevelCorrectedEvent,
  StockItemLevelCorrectedPayload,
  StockItemState,
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
