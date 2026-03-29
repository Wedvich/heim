import { describe, expect, it } from "vitest";
import type { AggregateConfig } from "../aggregate-registry.ts";
import type { Command } from "../commands.ts";
import { CommandHandlerRegistry } from "../commands.ts";
import type { DomainEvent } from "../events.ts";
import { applyInventoryItemEvent } from "./inventory-item-fold.ts";
import { inventoryItemHandler } from "./inventory-item-handler.ts";
import { INITIAL_INVENTORY_ITEM_STATE, type InventoryItemState } from "./inventory-item-state.ts";

function makeCommand(overrides?: Partial<Command>): Command {
  return {
    commandId: "cmd-1",
    correlationId: "corr-1",
    causationId: "corr-1",
    streamId: "si-1",
    streamType: "InventoryItem",
    type: "AddInventoryItem",
    payload: { productTypeId: "pt-1" },
    expectedVersion: 0,
    actualTime: new Date("2026-03-01T10:00:00Z"),
    tenantId: "tenant-1",
    actingPrincipalId: "principal-1",
    effectivePrincipalId: null,
    ...overrides,
  };
}

const EXISTING_STATE: InventoryItemState = {
  inventoryItemId: "si-1",
  productTypeId: "pt-1",
  level: "unopened",
  exactCount: null,
  expiryDate: null,
  purchaseDate: "2026-03-01",
  discarded: false,
  createdAt: new Date("2026-03-01T10:00:00Z"),
};

const DISCARDED_STATE: InventoryItemState = {
  ...EXISTING_STATE,
  level: "empty",
  discarded: true,
};

describe("inventoryItemHandler", () => {
  describe("AddInventoryItem", () => {
    it("produces InventoryItemAdded event on empty state", () => {
      const result = inventoryItemHandler.handle(INITIAL_INVENTORY_ITEM_STATE, makeCommand());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        eventType: "InventoryItemAdded",
        payload: {
          productTypeId: "pt-1",
          level: "unopened",
          expiryDate: null,
          purchaseDate: null,
        },
      });
    });

    it("includes expiry and purchase dates when provided", () => {
      const result = inventoryItemHandler.handle(
        INITIAL_INVENTORY_ITEM_STATE,
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

    it("rejects when inventory item already exists", () => {
      const result = inventoryItemHandler.handle(EXISTING_STATE, makeCommand());

      expect(result).toEqual({ ok: false, reason: "Inventory item already exists" });
    });
  });

  describe("ConsumeInventoryItem", () => {
    it("produces InventoryItemConsumed event", () => {
      const result = inventoryItemHandler.handle(
        EXISTING_STATE,
        makeCommand({
          type: "ConsumeInventoryItem",
          payload: { level: "opened" },
          expectedVersion: 1,
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        eventType: "InventoryItemConsumed",
        payload: { level: "opened", exactCount: null },
      });
      expect(result.followUps).toBeUndefined();
    });

    it("includes exact count when provided", () => {
      const result = inventoryItemHandler.handle(
        EXISTING_STATE,
        makeCommand({
          type: "ConsumeInventoryItem",
          payload: { level: "opened", exactCount: 28 },
          expectedVersion: 1,
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events[0]!.payload).toEqual({ level: "opened", exactCount: 28 });
    });

    it("produces follow-up DiscardInventoryItem intent when level is empty", () => {
      const result = inventoryItemHandler.handle(
        EXISTING_STATE,
        makeCommand({
          type: "ConsumeInventoryItem",
          payload: { level: "empty" },
          expectedVersion: 1,
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]!.eventType).toBe("InventoryItemConsumed");
      expect(result.followUps).toEqual([{ type: "DiscardInventoryItem", payload: {} }]);
    });

    it("rejects on discarded item", () => {
      const result = inventoryItemHandler.handle(
        DISCARDED_STATE,
        makeCommand({ type: "ConsumeInventoryItem", payload: { level: "opened" } }),
      );

      expect(result).toEqual({ ok: false, reason: "Cannot consume a discarded inventory item" });
    });

    it("rejects when inventory item does not exist", () => {
      const result = inventoryItemHandler.handle(
        INITIAL_INVENTORY_ITEM_STATE,
        makeCommand({ type: "ConsumeInventoryItem", payload: { level: "opened" } }),
      );

      expect(result).toEqual({ ok: false, reason: "Inventory item does not exist" });
    });
  });

  describe("CorrectInventoryItemLevel", () => {
    it("produces InventoryItemLevelCorrected event", () => {
      const result = inventoryItemHandler.handle(
        EXISTING_STATE,
        makeCommand({
          type: "CorrectInventoryItemLevel",
          payload: { level: "almostEmpty", exactCount: 3 },
          expectedVersion: 1,
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        eventType: "InventoryItemLevelCorrected",
        payload: { level: "almostEmpty", exactCount: 3 },
      });
      expect(result.followUps).toBeUndefined();
    });

    it("produces follow-up DiscardInventoryItem intent when corrected to empty", () => {
      const result = inventoryItemHandler.handle(
        EXISTING_STATE,
        makeCommand({
          type: "CorrectInventoryItemLevel",
          payload: { level: "empty" },
          expectedVersion: 1,
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.followUps).toEqual([{ type: "DiscardInventoryItem", payload: {} }]);
    });

    it("rejects when inventory item does not exist", () => {
      const result = inventoryItemHandler.handle(
        INITIAL_INVENTORY_ITEM_STATE,
        makeCommand({ type: "CorrectInventoryItemLevel", payload: { level: "opened" } }),
      );

      expect(result).toEqual({ ok: false, reason: "Inventory item does not exist" });
    });

    it("rejects on discarded item", () => {
      const result = inventoryItemHandler.handle(
        DISCARDED_STATE,
        makeCommand({ type: "CorrectInventoryItemLevel", payload: { level: "opened" } }),
      );

      expect(result).toEqual({
        ok: false,
        reason: "Cannot correct level of a discarded inventory item",
      });
    });
  });

  describe("DiscardInventoryItem", () => {
    it("produces InventoryItemDiscarded event", () => {
      const result = inventoryItemHandler.handle(
        EXISTING_STATE,
        makeCommand({ type: "DiscardInventoryItem", payload: {}, expectedVersion: 1 }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        eventType: "InventoryItemDiscarded",
        payload: {},
      });
    });

    it("rejects when inventory item does not exist", () => {
      const result = inventoryItemHandler.handle(
        INITIAL_INVENTORY_ITEM_STATE,
        makeCommand({ type: "DiscardInventoryItem", payload: {} }),
      );

      expect(result).toEqual({ ok: false, reason: "Inventory item does not exist" });
    });

    it("rejects when already discarded", () => {
      const result = inventoryItemHandler.handle(
        DISCARDED_STATE,
        makeCommand({ type: "DiscardInventoryItem", payload: {} }),
      );

      expect(result).toEqual({ ok: false, reason: "Inventory item already discarded" });
    });
  });

  it("rejects unknown command type", () => {
    const result = inventoryItemHandler.handle(
      INITIAL_INVENTORY_ITEM_STATE,
      makeCommand({ type: "MoveInventoryItem" }),
    );

    expect(result).toEqual({ ok: false, reason: "Unknown command type: MoveInventoryItem" });
  });

  describe("follow-up integration via CommandHandlerRegistry", () => {
    const config: AggregateConfig = {
      initial: INITIAL_INVENTORY_ITEM_STATE,
      apply: applyInventoryItemEvent as (state: unknown, event: DomainEvent) => unknown,
    };

    it("ConsumeInventoryItem to empty produces both Consumed and Discarded events", () => {
      const registry = new CommandHandlerRegistry();
      registry.register(inventoryItemHandler);

      const result = registry.handle(
        EXISTING_STATE,
        makeCommand({
          type: "ConsumeInventoryItem",
          payload: { level: "empty" },
          expectedVersion: 1,
        }),
        config,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(2);
      expect(result.events[0]!.eventType).toBe("InventoryItemConsumed");
      expect(result.events[0]!.streamPosition).toBe(2);
      expect(result.events[0]!.causationId).toBe("command:cmd-1");
      expect(result.events[1]!.eventType).toBe("InventoryItemDiscarded");
      expect(result.events[1]!.streamPosition).toBe(3);
      expect(result.events[1]!.causationId).toMatch(/^command:/);
    });

    it("follow-up command causation traces back to the triggering event", () => {
      const registry = new CommandHandlerRegistry();
      registry.register(inventoryItemHandler);

      const result = registry.handle(
        EXISTING_STATE,
        makeCommand({
          type: "ConsumeInventoryItem",
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

    it("CorrectInventoryItemLevel to empty produces both Corrected and Discarded events", () => {
      const registry = new CommandHandlerRegistry();
      registry.register(inventoryItemHandler);

      const result = registry.handle(
        EXISTING_STATE,
        makeCommand({
          type: "CorrectInventoryItemLevel",
          payload: { level: "empty" },
          expectedVersion: 1,
        }),
        config,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(2);
      expect(result.events[0]!.eventType).toBe("InventoryItemLevelCorrected");
      expect(result.events[1]!.eventType).toBe("InventoryItemDiscarded");
      expect(result.events[0]!.streamPosition).toBe(2);
      expect(result.events[1]!.streamPosition).toBe(3);
    });
  });
});
