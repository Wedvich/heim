import type { Command, CommandHandler, DecisionResult } from "../commands.ts";
import type { ProductTypeCommand } from "./product-type-commands.ts";
import type { ProductTypeState } from "./product-type-state.ts";

export const productTypeHandler: CommandHandler<ProductTypeState> = {
  streamType: "ProductType",

  handle(state: ProductTypeState, command: Command): DecisionResult {
    const cmd = command as ProductTypeCommand;

    switch (cmd.type) {
      case "CreateProductType": {
        if (state.productTypeId !== null) {
          return { ok: false, reason: "Product type already exists" };
        }
        return {
          ok: true,
          events: [
            {
              eventType: "ProductTypeCreated",
              payload: {
                name: cmd.payload.name,
                category: cmd.payload.category ?? null,
              },
            },
          ],
        };
      }

      case "UpdateProductType": {
        if (state.productTypeId === null) {
          return { ok: false, reason: "Product type does not exist" };
        }
        return {
          ok: true,
          events: [
            {
              eventType: "ProductTypeUpdated",
              payload: cmd.payload,
            },
          ],
        };
      }

      default:
        return { ok: false, reason: `Unknown command type: ${(command as Command).type}` };
    }
  },
};
