import { describe, expect, it } from "vitest";
import type { Command } from "../commands.ts";
import { productTypeHandler } from "./product-type-handler.ts";
import { INITIAL_PRODUCT_TYPE_STATE, type ProductTypeState } from "./product-type-state.ts";

function makeCommand(overrides?: Partial<Command>): Command {
  return {
    commandId: "cmd-1",
    correlationId: "corr-1",
    causationId: "corr-1",
    streamId: "pt-1",
    streamType: "ProductType",
    type: "CreateProductType",
    payload: { name: "Olive Oil", category: "pantry" },
    expectedVersion: 0,
    actualTime: new Date("2026-03-01T10:00:00Z"),
    tenantId: "tenant-1",
    actingPrincipalId: "principal-1",
    effectivePrincipalId: null,
    ...overrides,
  };
}

const EXISTING_STATE: ProductTypeState = {
  productTypeId: "pt-1",
  name: "Olive Oil",
  category: "pantry",
  createdAt: new Date("2026-03-01T10:00:00Z"),
};

describe("productTypeHandler", () => {
  describe("CreateProductType", () => {
    it("produces ProductTypeCreated event on empty state", () => {
      const result = productTypeHandler.handle(INITIAL_PRODUCT_TYPE_STATE, makeCommand());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        eventType: "ProductTypeCreated",
        payload: { name: "Olive Oil", category: "pantry" },
      });
    });

    it("defaults category to null when not provided", () => {
      const result = productTypeHandler.handle(
        INITIAL_PRODUCT_TYPE_STATE,
        makeCommand({ payload: { name: "Misc" } }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events[0]!.payload).toEqual({ name: "Misc", category: null });
    });

    it("rejects when product type already exists", () => {
      const result = productTypeHandler.handle(EXISTING_STATE, makeCommand());

      expect(result).toEqual({ ok: false, reason: "Product type already exists" });
    });
  });

  describe("UpdateProductType", () => {
    it("produces ProductTypeUpdated event on existing state", () => {
      const result = productTypeHandler.handle(
        EXISTING_STATE,
        makeCommand({
          type: "UpdateProductType",
          payload: { name: "Extra Virgin Olive Oil" },
          expectedVersion: 1,
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        eventType: "ProductTypeUpdated",
        payload: { name: "Extra Virgin Olive Oil" },
      });
    });

    it("rejects when product type does not exist", () => {
      const result = productTypeHandler.handle(
        INITIAL_PRODUCT_TYPE_STATE,
        makeCommand({ type: "UpdateProductType", payload: { name: "New" } }),
      );

      expect(result).toEqual({ ok: false, reason: "Product type does not exist" });
    });
  });

  it("rejects unknown command type", () => {
    const result = productTypeHandler.handle(
      INITIAL_PRODUCT_TYPE_STATE,
      makeCommand({ type: "DeleteProductType" }),
    );

    expect(result).toEqual({ ok: false, reason: "Unknown command type: DeleteProductType" });
  });
});
