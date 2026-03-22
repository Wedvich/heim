import type { StockItemEvent } from "./stock-item-events.ts";
import type { StockItemState } from "./stock-item-state.ts";

export function applyStockItemEvent(state: StockItemState, event: StockItemEvent): StockItemState {
  switch (event.eventType) {
    case "StockItemAdded":
      return {
        ...state,
        stockItemId: event.streamId,
        productTypeId: event.payload.productTypeId,
        level: event.payload.level,
        expiryDate: event.payload.expiryDate,
        purchaseDate: event.payload.purchaseDate,
        createdAt: event.actualTime,
      };
    case "StockItemConsumed":
    case "StockItemLevelCorrected":
      return {
        ...state,
        level: event.payload.level,
        exactCount: event.payload.exactCount,
      };
    case "StockItemDiscarded":
      return { ...state, discarded: true };
  }
}
