import type { Command } from "../commands.ts";
import type { InventoryItemLevel } from "./inventory-item-events.ts";

export interface AddInventoryItemPayload extends Readonly<Record<string, unknown>> {
  readonly productTypeId: string;
  readonly expiryDate?: string | null;
  readonly purchaseDate?: string | null;
}

export interface ConsumeInventoryItemPayload extends Readonly<Record<string, unknown>> {
  readonly level: InventoryItemLevel;
  readonly exactCount?: number | null;
}

export interface CorrectInventoryItemLevelPayload extends Readonly<Record<string, unknown>> {
  readonly level: InventoryItemLevel;
  readonly exactCount?: number | null;
}

export type InventoryItemCommandPayload =
  | { readonly type: "AddInventoryItem"; readonly payload: AddInventoryItemPayload }
  | { readonly type: "ConsumeInventoryItem"; readonly payload: ConsumeInventoryItemPayload }
  | {
      readonly type: "CorrectInventoryItemLevel";
      readonly payload: CorrectInventoryItemLevelPayload;
    }
  | { readonly type: "DiscardInventoryItem"; readonly payload: Readonly<Record<string, never>> };

export type InventoryItemCommand = Command & InventoryItemCommandPayload;
