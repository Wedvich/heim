import type { Command, CommandHandler, DecisionResult } from "../commands.ts";
import type { InventoryItemCommand } from "./inventory-item-commands.ts";
import type { InventoryItemState } from "./inventory-item-state.ts";

export const inventoryItemHandler: CommandHandler<InventoryItemState> = {
  streamType: "InventoryItem",

  handle(state: InventoryItemState, command: Command): DecisionResult {
    const cmd = command as InventoryItemCommand;

    switch (cmd.type) {
      case "AddInventoryItem": {
        if (state.inventoryItemId !== null) {
          return { ok: false, reason: "Inventory item already exists" };
        }
        return {
          ok: true,
          events: [
            {
              eventType: "InventoryItemAdded",
              payload: {
                productTypeId: cmd.payload.productTypeId,
                level: "unopened" as const,
                expiryDate: cmd.payload.expiryDate ?? null,
                purchaseDate: cmd.payload.purchaseDate ?? null,
              },
            },
          ],
        };
      }

      case "ConsumeInventoryItem": {
        if (state.inventoryItemId === null) {
          return { ok: false, reason: "Inventory item does not exist" };
        }
        if (state.discarded) {
          return { ok: false, reason: "Cannot consume a discarded inventory item" };
        }

        const { level, exactCount } = cmd.payload;
        return {
          ok: true,
          events: [
            {
              eventType: "InventoryItemConsumed",
              payload: { level, exactCount: exactCount ?? null },
            },
          ],
          followUps:
            level === "empty" ? [{ type: "DiscardInventoryItem", payload: {} }] : undefined,
        };
      }

      case "CorrectInventoryItemLevel": {
        if (state.inventoryItemId === null) {
          return { ok: false, reason: "Inventory item does not exist" };
        }
        if (state.discarded) {
          return { ok: false, reason: "Cannot correct level of a discarded inventory item" };
        }

        const { level, exactCount } = cmd.payload;
        return {
          ok: true,
          events: [
            {
              eventType: "InventoryItemLevelCorrected",
              payload: { level, exactCount: exactCount ?? null },
            },
          ],
          followUps:
            level === "empty" ? [{ type: "DiscardInventoryItem", payload: {} }] : undefined,
        };
      }

      case "DiscardInventoryItem": {
        if (state.inventoryItemId === null) {
          return { ok: false, reason: "Inventory item does not exist" };
        }
        if (state.discarded) {
          return { ok: false, reason: "Inventory item already discarded" };
        }
        return {
          ok: true,
          events: [
            {
              eventType: "InventoryItemDiscarded",
              payload: {},
            },
          ],
        };
      }

      default:
        return { ok: false, reason: `Unknown command type: ${(command as Command).type}` };
    }
  },
};
