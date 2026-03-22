import type { Command } from "../commands.ts";
import type { StockItemLevel } from "./stock-item-events.ts";

export interface AddStockItemPayload extends Readonly<Record<string, unknown>> {
  readonly productTypeId: string;
  readonly expiryDate?: string | null;
  readonly purchaseDate?: string | null;
}

export interface ConsumeStockItemPayload extends Readonly<Record<string, unknown>> {
  readonly level: StockItemLevel;
  readonly exactCount?: number | null;
}

export interface CorrectStockItemLevelPayload extends Readonly<Record<string, unknown>> {
  readonly level: StockItemLevel;
  readonly exactCount?: number | null;
}

export type StockItemCommandPayload =
  | { readonly type: "AddStockItem"; readonly payload: AddStockItemPayload }
  | { readonly type: "ConsumeStockItem"; readonly payload: ConsumeStockItemPayload }
  | { readonly type: "CorrectStockItemLevel"; readonly payload: CorrectStockItemLevelPayload }
  | { readonly type: "DiscardStockItem"; readonly payload: Readonly<Record<string, never>> };

export type StockItemCommand = Command & StockItemCommandPayload;
