import { describe, expect, it } from "vitest";
import type {
  InventoryItemAddedEvent,
  InventoryItemConsumedEvent,
  InventoryItemDiscardedEvent,
} from "@heim/domain";
import { InventoryItemModel } from "./inventory-item-model.ts";

const BASE_FIELDS = {
  tenantId: "tenant-1",
  streamId: "si-1",
  streamType: "InventoryItem" as const,
  correlationId: "corr-1",
  causationId: "caus-1",
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
      expiryDate: "2026-06-01",
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

function makeInventoryItemDiscardedEvent(
  overrides?: Partial<InventoryItemDiscardedEvent>,
): InventoryItemDiscardedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-3",
    streamPosition: 3,
    eventType: "InventoryItemDiscarded",
    payload: {},
    actualTime: new Date("2026-03-03T10:00:00Z"),
    ...overrides,
  };
}

describe("InventoryItemModel", () => {
  it("defaults to initial state with version 0", () => {
    const model = new InventoryItemModel("si-1");

    expect(model.streamId).toBe("si-1");
    expect(model.streamType).toBe("InventoryItem");
    expect(model.productTypeId).toBeNull();
    expect(model.level).toBeNull();
    expect(model.discarded).toBe(false);
    expect(model.expiryDate).toBeNull();
    expect(model.version).toBe(0);
  });

  it("folds InventoryItemAdded and exposes computed getters", () => {
    const model = new InventoryItemModel("si-1");

    model.applyEvent(makeInventoryItemAddedEvent());

    expect(model.productTypeId).toBe("pt-1");
    expect(model.level).toBe("unopened");
    expect(model.expiryDate).toBe("2026-06-01");
    expect(model.version).toBe(1);
  });

  it("folds InventoryItemConsumed", () => {
    const model = new InventoryItemModel("si-1");
    model.applyEvent(makeInventoryItemAddedEvent());
    model.applyEvent(makeInventoryItemConsumedEvent());

    expect(model.level).toBe("opened");
    expect(model.version).toBe(2);
  });

  it("folds InventoryItemDiscarded", () => {
    const model = new InventoryItemModel("si-1");
    model.applyEvent(makeInventoryItemAddedEvent());
    model.applyEvent(makeInventoryItemDiscardedEvent({ streamPosition: 2 }));

    expect(model.discarded).toBe(true);
    expect(model.version).toBe(2);
  });
});
