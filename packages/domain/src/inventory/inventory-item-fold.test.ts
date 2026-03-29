import { describe, expect, it } from "vitest";
import { buildAggregate } from "../aggregate.ts";
import type {
  InventoryItemAddedEvent,
  InventoryItemConsumedEvent,
  InventoryItemDiscardedEvent,
  InventoryItemLevelCorrectedEvent,
} from "./inventory-item-events.ts";
import { applyInventoryItemEvent } from "./inventory-item-fold.ts";
import { INITIAL_INVENTORY_ITEM_STATE } from "./inventory-item-state.ts";

const BASE_FIELDS = {
  tenantId: "tenant-1",
  streamId: "si-1",
  streamType: "InventoryItem" as const,
  correlationId: "corr-1",
  causationId: "corr-1",
  actingPrincipalId: "principal-1",
  effectivePrincipalId: null,
  metadata: {},
};

function makeInventoryItemAddedEvent(
  overrides?: Partial<InventoryItemAddedEvent>,
): InventoryItemAddedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-1",
    streamPosition: 1,
    eventType: "InventoryItemAdded",
    payload: {
      productTypeId: "pt-1",
      level: "unopened",
      expiryDate: null,
      purchaseDate: "2026-03-01",
    },
    actualTime: new Date("2026-03-01T10:00:00Z"),
    ...overrides,
  };
}

function makeInventoryItemConsumedEvent(
  overrides?: Partial<InventoryItemConsumedEvent>,
): InventoryItemConsumedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-2",
    streamPosition: 2,
    eventType: "InventoryItemConsumed",
    payload: { level: "opened", exactCount: null },
    actualTime: new Date("2026-03-02T10:00:00Z"),
    ...overrides,
  };
}

function makeInventoryItemLevelCorrectedEvent(
  overrides?: Partial<InventoryItemLevelCorrectedEvent>,
): InventoryItemLevelCorrectedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-3",
    streamPosition: 3,
    eventType: "InventoryItemLevelCorrected",
    payload: { level: "almostEmpty", exactCount: 5 },
    actualTime: new Date("2026-03-03T10:00:00Z"),
    ...overrides,
  };
}

function makeInventoryItemDiscardedEvent(
  overrides?: Partial<InventoryItemDiscardedEvent>,
): InventoryItemDiscardedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-4",
    streamPosition: 4,
    eventType: "InventoryItemDiscarded",
    payload: {},
    actualTime: new Date("2026-03-04T10:00:00Z"),
    ...overrides,
  };
}

describe("applyInventoryItemEvent", () => {
  it("applies InventoryItemAdded", () => {
    const state = applyInventoryItemEvent(
      INITIAL_INVENTORY_ITEM_STATE,
      makeInventoryItemAddedEvent(),
    );

    expect(state.inventoryItemId).toBe("si-1");
    expect(state.productTypeId).toBe("pt-1");
    expect(state.level).toBe("unopened");
    expect(state.expiryDate).toBeNull();
    expect(state.purchaseDate).toBe("2026-03-01");
    expect(state.createdAt).toEqual(new Date("2026-03-01T10:00:00Z"));
    expect(state.discarded).toBe(false);
  });

  it("applies InventoryItemAdded with expiry date", () => {
    const state = applyInventoryItemEvent(
      INITIAL_INVENTORY_ITEM_STATE,
      makeInventoryItemAddedEvent({
        payload: {
          productTypeId: "pt-1",
          level: "unopened",
          expiryDate: "2026-06-01",
          purchaseDate: null,
        },
      }),
    );

    expect(state.expiryDate).toBe("2026-06-01");
    expect(state.purchaseDate).toBeNull();
  });

  it("applies InventoryItemConsumed", () => {
    const added = applyInventoryItemEvent(
      INITIAL_INVENTORY_ITEM_STATE,
      makeInventoryItemAddedEvent(),
    );
    const state = applyInventoryItemEvent(added, makeInventoryItemConsumedEvent());

    expect(state.level).toBe("opened");
    expect(state.exactCount).toBeNull();
  });

  it("applies InventoryItemConsumed with exact count", () => {
    const added = applyInventoryItemEvent(
      INITIAL_INVENTORY_ITEM_STATE,
      makeInventoryItemAddedEvent(),
    );
    const state = applyInventoryItemEvent(
      added,
      makeInventoryItemConsumedEvent({ payload: { level: "opened", exactCount: 28 } }),
    );

    expect(state.level).toBe("opened");
    expect(state.exactCount).toBe(28);
  });

  it("applies InventoryItemLevelCorrected", () => {
    const added = applyInventoryItemEvent(
      INITIAL_INVENTORY_ITEM_STATE,
      makeInventoryItemAddedEvent(),
    );
    const state = applyInventoryItemEvent(added, makeInventoryItemLevelCorrectedEvent());

    expect(state.level).toBe("almostEmpty");
    expect(state.exactCount).toBe(5);
  });

  it("applies InventoryItemDiscarded", () => {
    const added = applyInventoryItemEvent(
      INITIAL_INVENTORY_ITEM_STATE,
      makeInventoryItemAddedEvent(),
    );
    const state = applyInventoryItemEvent(
      added,
      makeInventoryItemDiscardedEvent({ streamPosition: 2 }),
    );

    expect(state.discarded).toBe(true);
  });
});

describe("buildAggregate (InventoryItem)", () => {
  it("returns initial state for empty event stream", () => {
    const aggregate = buildAggregate(INITIAL_INVENTORY_ITEM_STATE, [], applyInventoryItemEvent);

    expect(aggregate.state).toEqual(INITIAL_INVENTORY_ITEM_STATE);
    expect(aggregate.version).toBe(0);
  });

  it("full lifecycle: add → consume → consume to empty → discard", () => {
    const events = [
      makeInventoryItemAddedEvent(),
      makeInventoryItemConsumedEvent({ payload: { level: "opened", exactCount: null } }),
      makeInventoryItemConsumedEvent({
        id: "evt-3",
        streamPosition: 3,
        payload: { level: "empty", exactCount: 0 },
      }),
      makeInventoryItemDiscardedEvent(),
    ];
    const aggregate = buildAggregate(INITIAL_INVENTORY_ITEM_STATE, events, applyInventoryItemEvent);

    expect(aggregate.state.level).toBe("empty");
    expect(aggregate.state.discarded).toBe(true);
    expect(aggregate.version).toBe(4);
  });
});
