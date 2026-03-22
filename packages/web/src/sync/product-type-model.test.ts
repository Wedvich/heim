import { describe, expect, it } from "vitest";
import type { ProductTypeCreatedEvent, ProductTypeUpdatedEvent } from "@heim/domain";
import { ProductTypeModel } from "./product-type-model.ts";

const BASE_FIELDS = {
  tenantId: "tenant-1",
  streamId: "pt-1",
  streamType: "ProductType" as const,
  correlationId: "corr-1",
  causationId: "caus-1",
  actingPrincipalId: "principal-1",
  effectivePrincipalId: null,
  metadata: {},
};

function makeProductTypeCreatedEvent(
  overrides?: Partial<ProductTypeCreatedEvent>,
): ProductTypeCreatedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-1",
    streamPosition: 1,
    eventType: "ProductTypeCreated",
    payload: { name: "Olive Oil", category: "pantry" },
    actualTime: new Date("2026-03-01T10:00:00Z"),
    ...overrides,
  };
}

function makeProductTypeUpdatedEvent(
  overrides?: Partial<ProductTypeUpdatedEvent>,
): ProductTypeUpdatedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-2",
    streamPosition: 2,
    eventType: "ProductTypeUpdated",
    payload: { name: "Extra Virgin Olive Oil" },
    actualTime: new Date("2026-03-01T11:00:00Z"),
    ...overrides,
  };
}

describe("ProductTypeModel", () => {
  it("defaults to initial state with version 0", () => {
    const model = new ProductTypeModel("pt-1");

    expect(model.streamId).toBe("pt-1");
    expect(model.streamType).toBe("ProductType");
    expect(model.name).toBeNull();
    expect(model.category).toBeNull();
    expect(model.version).toBe(0);
  });

  it("folds ProductTypeCreated and exposes computed getters", () => {
    const model = new ProductTypeModel("pt-1");

    model.applyEvent(makeProductTypeCreatedEvent());

    expect(model.name).toBe("Olive Oil");
    expect(model.category).toBe("pantry");
    expect(model.version).toBe(1);
  });

  it("folds ProductTypeUpdated", () => {
    const model = new ProductTypeModel("pt-1");
    model.applyEvent(makeProductTypeCreatedEvent());
    model.applyEvent(makeProductTypeUpdatedEvent());

    expect(model.name).toBe("Extra Virgin Olive Oil");
    expect(model.category).toBe("pantry");
    expect(model.version).toBe(2);
  });
});
