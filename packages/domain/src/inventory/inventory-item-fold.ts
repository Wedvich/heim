import type { InventoryItemEvent } from "./inventory-item-events.ts";
import type { InventoryItemState } from "./inventory-item-state.ts";

export function applyInventoryItemEvent(
  state: InventoryItemState,
  event: InventoryItemEvent,
): InventoryItemState {
  switch (event.eventType) {
    case "InventoryItemAdded":
      return {
        ...state,
        inventoryItemId: event.streamId,
        productTypeId: event.payload.productTypeId,
        level: event.payload.level,
        expiryDate: event.payload.expiryDate,
        purchaseDate: event.payload.purchaseDate,
        createdAt: event.actualTime,
      };
    case "InventoryItemConsumed":
    case "InventoryItemLevelCorrected":
      return {
        ...state,
        level: event.payload.level,
        exactCount: event.payload.exactCount,
      };
    case "InventoryItemDiscarded":
      return { ...state, discarded: true };
  }
}
