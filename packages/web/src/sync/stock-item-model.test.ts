import { describe, expect, it } from "vitest";
import type {
  StockItemAddedEvent,
  StockItemConsumedEvent,
  StockItemDiscardedEvent,
} from "@heim/domain";
import { StockItemModel } from "./stock-item-model.ts";

const BASE_FIELDS = {
  tenantId: "tenant-1",
  streamId: "si-1",
  streamType: "StockItem" as const,
  correlationId: "corr-1",
  causationId: "caus-1",
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
      expiryDate: "2026-06-01",
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

function makeStockItemDiscardedEvent(
  overrides?: Partial<StockItemDiscardedEvent>,
): StockItemDiscardedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-3",
    streamPosition: 3,
    eventType: "StockItemDiscarded",
    payload: {},
    actualTime: new Date("2026-03-03T10:00:00Z"),
    ...overrides,
  };
}

describe("StockItemModel", () => {
  it("defaults to initial state with version 0", () => {
    const model = new StockItemModel("si-1");

    expect(model.streamId).toBe("si-1");
    expect(model.streamType).toBe("StockItem");
    expect(model.productTypeId).toBeNull();
    expect(model.level).toBeNull();
    expect(model.discarded).toBe(false);
    expect(model.expiryDate).toBeNull();
    expect(model.version).toBe(0);
  });

  it("folds StockItemAdded and exposes computed getters", () => {
    const model = new StockItemModel("si-1");

    model.applyEvent(makeStockItemAddedEvent());

    expect(model.productTypeId).toBe("pt-1");
    expect(model.level).toBe("unopened");
    expect(model.expiryDate).toBe("2026-06-01");
    expect(model.version).toBe(1);
  });

  it("folds StockItemConsumed", () => {
    const model = new StockItemModel("si-1");
    model.applyEvent(makeStockItemAddedEvent());
    model.applyEvent(makeStockItemConsumedEvent());

    expect(model.level).toBe("opened");
    expect(model.version).toBe(2);
  });

  it("folds StockItemDiscarded", () => {
    const model = new StockItemModel("si-1");
    model.applyEvent(makeStockItemAddedEvent());
    model.applyEvent(makeStockItemDiscardedEvent({ streamPosition: 2 }));

    expect(model.discarded).toBe(true);
    expect(model.version).toBe(2);
  });
});
