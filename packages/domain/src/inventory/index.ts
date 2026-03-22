export type {
  CreateProductTypePayload,
  ProductTypeCommand,
  ProductTypeCommandPayload,
  UpdateProductTypePayload,
} from "./product-type-commands.ts";
export type {
  ProductTypeCreatedEvent,
  ProductTypeCreatedPayload,
  ProductTypeEvent,
  ProductTypeUpdatedEvent,
  ProductTypeUpdatedPayload,
} from "./product-type-events.ts";
export { applyProductTypeEvent } from "./product-type-fold.ts";
export { productTypeHandler } from "./product-type-handler.ts";
export { INITIAL_PRODUCT_TYPE_STATE, type ProductTypeState } from "./product-type-state.ts";

export type {
  AddStockItemPayload,
  ConsumeStockItemPayload,
  CorrectStockItemLevelPayload,
  StockItemCommand,
  StockItemCommandPayload,
} from "./stock-item-commands.ts";
export type {
  StockItemAddedEvent,
  StockItemAddedPayload,
  StockItemConsumedEvent,
  StockItemConsumedPayload,
  StockItemDiscardedEvent,
  StockItemEvent,
  StockItemLevel,
  StockItemLevelCorrectedEvent,
  StockItemLevelCorrectedPayload,
} from "./stock-item-events.ts";
export { STOCK_ITEM_LEVELS } from "./stock-item-events.ts";
export { applyStockItemEvent } from "./stock-item-fold.ts";
export { stockItemHandler } from "./stock-item-handler.ts";
export { INITIAL_STOCK_ITEM_STATE, type StockItemState } from "./stock-item-state.ts";
