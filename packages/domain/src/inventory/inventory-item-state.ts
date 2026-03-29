import type { InventoryItemLevel } from "./inventory-item-events.ts";

export interface InventoryItemState {
  readonly inventoryItemId: string | null;
  readonly productTypeId: string | null;
  readonly level: InventoryItemLevel | null;
  readonly exactCount: number | null;
  readonly expiryDate: string | null;
  readonly purchaseDate: string | null;
  readonly discarded: boolean;
  readonly createdAt: Date | null;
}

export const INITIAL_INVENTORY_ITEM_STATE: InventoryItemState = {
  inventoryItemId: null,
  productTypeId: null,
  level: null,
  exactCount: null,
  expiryDate: null,
  purchaseDate: null,
  discarded: false,
  createdAt: null,
};
