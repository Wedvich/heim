import { describe, expect, it } from "vitest";
import type { AggregateConfig } from "../aggregate-registry.ts";
import type { Command } from "../commands.ts";
import { CommandHandlerRegistry } from "../commands.ts";
import type { DomainEvent } from "../events.ts";
import { applyStockItemEvent } from "./stock-item-fold.ts";
import { stockItemHandler } from "./stock-item-handler.ts";
import { INITIAL_STOCK_ITEM_STATE, type StockItemState } from "./stock-item-state.ts";

function makeCommand(overrides?: Partial<Command>): Command {
  return {
    commandId: "cmd-1",
    correlationId: "corr-1",
    causationId: "corr-1",
    streamId: "si-1",
    streamType: "StockItem",
    type: "AddStockItem",
    payload: { productTypeId: "pt-1" },
    expectedVersion: 0,
    actualTime: new Date("2026-03-01T10:00:00Z"),
    tenantId: "tenant-1",
    actingPrincipalId: "principal-1",
    effectivePrincipalId: null,
    ...overrides,
  };
}

const EXISTING_STATE: StockItemState = {
  stockItemId: "si-1",
  productTypeId: "pt-1",
  level: "unopened",
  exactCount: null,
  expiryDate: null,
  purchaseDate: "2026-03-01",
  discarded: false,
  createdAt: new Date("2026-03-01T10:00:00Z"),
};

const DISCARDED_STATE: StockItemState = {
  ...EXISTING_STATE,
  level: "empty",
  discarded: true,
};

describe("stockItemHandler", () => {
  describe("AddStockItem", () => {
    it("produces StockItemAdded event on empty state", () => {
      const result = stockItemHandler.handle(INITIAL_STOCK_ITEM_STATE, makeCommand());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        eventType: "StockItemAdded",
        payload: {
          productTypeId: "pt-1",
          level: "unopened",
          expiryDate: null,
          purchaseDate: null,
        },
      });
    });

    it("includes expiry and purchase dates when provided", () => {
      const result = stockItemHandler.handle(
        INITIAL_STOCK_ITEM_STATE,
        makeCommand({
          payload: { productTypeId: "pt-1", expiryDate: "2026-06-01", purchaseDate: "2026-03-01" },
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events[0]!.payload).toEqual({
        productTypeId: "pt-1",
        level: "unopened",
        expiryDate: "2026-06-01",
        purchaseDate: "2026-03-01",
      });
    });

    it("rejects when stock item already exists", () => {
      const result = stockItemHandler.handle(EXISTING_STATE, makeCommand());

      expect(result).toEqual({ ok: false, reason: "Stock item already exists" });
    });
  });

  describe("ConsumeStockItem", () => {
    it("produces StockItemConsumed event", () => {
      const result = stockItemHandler.handle(
        EXISTING_STATE,
        makeCommand({
          type: "ConsumeStockItem",
          payload: { level: "opened" },
          expectedVersion: 1,
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        eventType: "StockItemConsumed",
        payload: { level: "opened", exactCount: null },
      });
      expect(result.followUps).toBeUndefined();
    });

    it("includes exact count when provided", () => {
      const result = stockItemHandler.handle(
        EXISTING_STATE,
        makeCommand({
          type: "ConsumeStockItem",
          payload: { level: "opened", exactCount: 28 },
          expectedVersion: 1,
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events[0]!.payload).toEqual({ level: "opened", exactCount: 28 });
    });

    it("produces follow-up DiscardStockItem intent when level is empty", () => {
      const result = stockItemHandler.handle(
        EXISTING_STATE,
        makeCommand({
          type: "ConsumeStockItem",
          payload: { level: "empty" },
          expectedVersion: 1,
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]!.eventType).toBe("StockItemConsumed");
      expect(result.followUps).toEqual([{ type: "DiscardStockItem", payload: {} }]);
    });

    it("rejects on discarded item", () => {
      const result = stockItemHandler.handle(
        DISCARDED_STATE,
        makeCommand({ type: "ConsumeStockItem", payload: { level: "opened" } }),
      );

      expect(result).toEqual({ ok: false, reason: "Cannot consume a discarded stock item" });
    });

    it("rejects when stock item does not exist", () => {
      const result = stockItemHandler.handle(
        INITIAL_STOCK_ITEM_STATE,
        makeCommand({ type: "ConsumeStockItem", payload: { level: "opened" } }),
      );

      expect(result).toEqual({ ok: false, reason: "Stock item does not exist" });
    });
  });

  describe("CorrectStockItemLevel", () => {
    it("produces StockItemLevelCorrected event", () => {
      const result = stockItemHandler.handle(
        EXISTING_STATE,
        makeCommand({
          type: "CorrectStockItemLevel",
          payload: { level: "almostEmpty", exactCount: 3 },
          expectedVersion: 1,
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        eventType: "StockItemLevelCorrected",
        payload: { level: "almostEmpty", exactCount: 3 },
      });
      expect(result.followUps).toBeUndefined();
    });

    it("produces follow-up DiscardStockItem intent when corrected to empty", () => {
      const result = stockItemHandler.handle(
        EXISTING_STATE,
        makeCommand({
          type: "CorrectStockItemLevel",
          payload: { level: "empty" },
          expectedVersion: 1,
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.followUps).toEqual([{ type: "DiscardStockItem", payload: {} }]);
    });

    it("rejects when stock item does not exist", () => {
      const result = stockItemHandler.handle(
        INITIAL_STOCK_ITEM_STATE,
        makeCommand({ type: "CorrectStockItemLevel", payload: { level: "opened" } }),
      );

      expect(result).toEqual({ ok: false, reason: "Stock item does not exist" });
    });

    it("rejects on discarded item", () => {
      const result = stockItemHandler.handle(
        DISCARDED_STATE,
        makeCommand({ type: "CorrectStockItemLevel", payload: { level: "opened" } }),
      );

      expect(result).toEqual({
        ok: false,
        reason: "Cannot correct level of a discarded stock item",
      });
    });
  });

  describe("DiscardStockItem", () => {
    it("produces StockItemDiscarded event", () => {
      const result = stockItemHandler.handle(
        EXISTING_STATE,
        makeCommand({ type: "DiscardStockItem", payload: {}, expectedVersion: 1 }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        eventType: "StockItemDiscarded",
        payload: {},
      });
    });

    it("rejects when stock item does not exist", () => {
      const result = stockItemHandler.handle(
        INITIAL_STOCK_ITEM_STATE,
        makeCommand({ type: "DiscardStockItem", payload: {} }),
      );

      expect(result).toEqual({ ok: false, reason: "Stock item does not exist" });
    });

    it("rejects when already discarded", () => {
      const result = stockItemHandler.handle(
        DISCARDED_STATE,
        makeCommand({ type: "DiscardStockItem", payload: {} }),
      );

      expect(result).toEqual({ ok: false, reason: "Stock item already discarded" });
    });
  });

  it("rejects unknown command type", () => {
    const result = stockItemHandler.handle(
      INITIAL_STOCK_ITEM_STATE,
      makeCommand({ type: "MoveStockItem" }),
    );

    expect(result).toEqual({ ok: false, reason: "Unknown command type: MoveStockItem" });
  });

  describe("follow-up integration via CommandHandlerRegistry", () => {
    const config: AggregateConfig = {
      initial: INITIAL_STOCK_ITEM_STATE,
      apply: applyStockItemEvent as (state: unknown, event: DomainEvent) => unknown,
    };

    it("ConsumeStockItem to empty produces both Consumed and Discarded events", () => {
      const registry = new CommandHandlerRegistry();
      registry.register(stockItemHandler);

      const result = registry.handle(
        EXISTING_STATE,
        makeCommand({
          type: "ConsumeStockItem",
          payload: { level: "empty" },
          expectedVersion: 1,
        }),
        config,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(2);
      expect(result.events[0]!.eventType).toBe("StockItemConsumed");
      expect(result.events[0]!.streamPosition).toBe(2);
      expect(result.events[0]!.causationId).toBe("command:cmd-1");
      expect(result.events[1]!.eventType).toBe("StockItemDiscarded");
      expect(result.events[1]!.streamPosition).toBe(3);
      expect(result.events[1]!.causationId).toMatch(/^command:/);
    });

    it("follow-up command causation traces back to the triggering event", () => {
      const registry = new CommandHandlerRegistry();
      registry.register(stockItemHandler);

      const result = registry.handle(
        EXISTING_STATE,
        makeCommand({
          type: "ConsumeStockItem",
          payload: { level: "empty" },
          expectedVersion: 1,
        }),
        config,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // The follow-up command's causationId is event:<first event id>
      // which means the second event's causationId is command:<follow-up command id>
      // Both events should have valid causation chains
      expect(result.events[0]!.causationId).toBe("command:cmd-1");
      expect(result.events[1]!.causationId).toMatch(/^command:[0-9a-f-]+$/);
    });

    it("CorrectStockItemLevel to empty produces both Corrected and Discarded events", () => {
      const registry = new CommandHandlerRegistry();
      registry.register(stockItemHandler);

      const result = registry.handle(
        EXISTING_STATE,
        makeCommand({
          type: "CorrectStockItemLevel",
          payload: { level: "empty" },
          expectedVersion: 1,
        }),
        config,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(2);
      expect(result.events[0]!.eventType).toBe("StockItemLevelCorrected");
      expect(result.events[1]!.eventType).toBe("StockItemDiscarded");
      expect(result.events[0]!.streamPosition).toBe(2);
      expect(result.events[1]!.streamPosition).toBe(3);
    });
  });
});
