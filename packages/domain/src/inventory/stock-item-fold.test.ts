import { describe, expect, it } from "vitest";
import { buildAggregate } from "../aggregate.ts";
import type {
  StockItemAddedEvent,
  StockItemConsumedEvent,
  StockItemDiscardedEvent,
  StockItemLevelCorrectedEvent,
} from "./stock-item-events.ts";
import { applyStockItemEvent } from "./stock-item-fold.ts";
import { INITIAL_STOCK_ITEM_STATE } from "./stock-item-state.ts";

const BASE_FIELDS = {
  tenantId: "tenant-1",
  streamId: "si-1",
  streamType: "StockItem" as const,
  correlationId: "corr-1",
  causationId: "corr-1",
  actingPrincipalId: "principal-1",
  effectivePrincipalId: null,
  metadata: {},
};

function makeStockItemAddedEvent(overrides?: Partial<StockItemAddedEvent>): StockItemAddedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-1",
    streamPosition: 1,
    eventType: "StockItemAdded",
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

function makeStockItemConsumedEvent(
  overrides?: Partial<StockItemConsumedEvent>,
): StockItemConsumedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-2",
    streamPosition: 2,
    eventType: "StockItemConsumed",
    payload: { level: "opened", exactCount: null },
    actualTime: new Date("2026-03-02T10:00:00Z"),
    ...overrides,
  };
}

function makeStockItemLevelCorrectedEvent(
  overrides?: Partial<StockItemLevelCorrectedEvent>,
): StockItemLevelCorrectedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-3",
    streamPosition: 3,
    eventType: "StockItemLevelCorrected",
    payload: { level: "almostEmpty", exactCount: 5 },
    actualTime: new Date("2026-03-03T10:00:00Z"),
    ...overrides,
  };
}

function makeStockItemDiscardedEvent(
  overrides?: Partial<StockItemDiscardedEvent>,
): StockItemDiscardedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-4",
    streamPosition: 4,
    eventType: "StockItemDiscarded",
    payload: {},
    actualTime: new Date("2026-03-04T10:00:00Z"),
    ...overrides,
  };
}

describe("applyStockItemEvent", () => {
  it("applies StockItemAdded", () => {
    const state = applyStockItemEvent(INITIAL_STOCK_ITEM_STATE, makeStockItemAddedEvent());

    expect(state.stockItemId).toBe("si-1");
    expect(state.productTypeId).toBe("pt-1");
    expect(state.level).toBe("unopened");
    expect(state.expiryDate).toBeNull();
    expect(state.purchaseDate).toBe("2026-03-01");
    expect(state.createdAt).toEqual(new Date("2026-03-01T10:00:00Z"));
    expect(state.discarded).toBe(false);
  });

  it("applies StockItemAdded with expiry date", () => {
    const state = applyStockItemEvent(
      INITIAL_STOCK_ITEM_STATE,
      makeStockItemAddedEvent({
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

  it("applies StockItemConsumed", () => {
    const added = applyStockItemEvent(INITIAL_STOCK_ITEM_STATE, makeStockItemAddedEvent());
    const state = applyStockItemEvent(added, makeStockItemConsumedEvent());

    expect(state.level).toBe("opened");
    expect(state.exactCount).toBeNull();
  });

  it("applies StockItemConsumed with exact count", () => {
    const added = applyStockItemEvent(INITIAL_STOCK_ITEM_STATE, makeStockItemAddedEvent());
    const state = applyStockItemEvent(
      added,
      makeStockItemConsumedEvent({ payload: { level: "opened", exactCount: 28 } }),
    );

    expect(state.level).toBe("opened");
    expect(state.exactCount).toBe(28);
  });

  it("applies StockItemLevelCorrected", () => {
    const added = applyStockItemEvent(INITIAL_STOCK_ITEM_STATE, makeStockItemAddedEvent());
    const state = applyStockItemEvent(added, makeStockItemLevelCorrectedEvent());

    expect(state.level).toBe("almostEmpty");
    expect(state.exactCount).toBe(5);
  });

  it("applies StockItemDiscarded", () => {
    const added = applyStockItemEvent(INITIAL_STOCK_ITEM_STATE, makeStockItemAddedEvent());
    const state = applyStockItemEvent(added, makeStockItemDiscardedEvent({ streamPosition: 2 }));

    expect(state.discarded).toBe(true);
  });
});

describe("buildAggregate (StockItem)", () => {
  it("returns initial state for empty event stream", () => {
    const aggregate = buildAggregate(INITIAL_STOCK_ITEM_STATE, [], applyStockItemEvent);

    expect(aggregate.state).toEqual(INITIAL_STOCK_ITEM_STATE);
    expect(aggregate.version).toBe(0);
  });

  it("full lifecycle: add → consume → consume to empty → discard", () => {
    const events = [
      makeStockItemAddedEvent(),
      makeStockItemConsumedEvent({ payload: { level: "opened", exactCount: null } }),
      makeStockItemConsumedEvent({
        id: "evt-3",
        streamPosition: 3,
        payload: { level: "empty", exactCount: 0 },
      }),
      makeStockItemDiscardedEvent(),
    ];
    const aggregate = buildAggregate(INITIAL_STOCK_ITEM_STATE, events, applyStockItemEvent);

    expect(aggregate.state.level).toBe("empty");
    expect(aggregate.state.discarded).toBe(true);
    expect(aggregate.version).toBe(4);
  });
});
