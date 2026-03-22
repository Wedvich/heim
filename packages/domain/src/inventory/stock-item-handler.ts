import type { Command, CommandHandler, DecisionResult } from "../commands.ts";
import type { StockItemCommand } from "./stock-item-commands.ts";
import type { StockItemState } from "./stock-item-state.ts";

export const stockItemHandler: CommandHandler<StockItemState> = {
  streamType: "StockItem",

  handle(state: StockItemState, command: Command): DecisionResult {
    const cmd = command as StockItemCommand;

    switch (cmd.type) {
      case "AddStockItem": {
        if (state.stockItemId !== null) {
          return { ok: false, reason: "Stock item already exists" };
        }
        return {
          ok: true,
          events: [
            {
              eventType: "StockItemAdded",
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

      case "ConsumeStockItem": {
        if (state.stockItemId === null) {
          return { ok: false, reason: "Stock item does not exist" };
        }
        if (state.discarded) {
          return { ok: false, reason: "Cannot consume a discarded stock item" };
        }

        const { level, exactCount } = cmd.payload;
        return {
          ok: true,
          events: [
            {
              eventType: "StockItemConsumed",
              payload: { level, exactCount: exactCount ?? null },
            },
          ],
          followUps: level === "empty" ? [{ type: "DiscardStockItem", payload: {} }] : undefined,
        };
      }

      case "CorrectStockItemLevel": {
        if (state.stockItemId === null) {
          return { ok: false, reason: "Stock item does not exist" };
        }
        if (state.discarded) {
          return { ok: false, reason: "Cannot correct level of a discarded stock item" };
        }

        const { level, exactCount } = cmd.payload;
        return {
          ok: true,
          events: [
            {
              eventType: "StockItemLevelCorrected",
              payload: { level, exactCount: exactCount ?? null },
            },
          ],
          followUps: level === "empty" ? [{ type: "DiscardStockItem", payload: {} }] : undefined,
        };
      }

      case "DiscardStockItem": {
        if (state.stockItemId === null) {
          return { ok: false, reason: "Stock item does not exist" };
        }
        if (state.discarded) {
          return { ok: false, reason: "Stock item already discarded" };
        }
        return {
          ok: true,
          events: [
            {
              eventType: "StockItemDiscarded",
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
