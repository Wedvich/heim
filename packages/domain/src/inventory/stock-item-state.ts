import type { StockItemLevel } from "./stock-item-events.ts";

export interface StockItemState {
  readonly stockItemId: string | null;
  readonly productTypeId: string | null;
  readonly level: StockItemLevel | null;
  readonly exactCount: number | null;
  readonly expiryDate: string | null;
  readonly purchaseDate: string | null;
  readonly discarded: boolean;
  readonly createdAt: Date | null;
}

export const INITIAL_STOCK_ITEM_STATE: StockItemState = {
  stockItemId: null,
  productTypeId: null,
  level: null,
  exactCount: null,
  expiryDate: null,
  purchaseDate: null,
  discarded: false,
  createdAt: null,
};
