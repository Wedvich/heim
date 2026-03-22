import { describe, expect, it } from "vitest";
import { buildAggregate } from "../aggregate.ts";
import type { ProductTypeCreatedEvent, ProductTypeUpdatedEvent } from "./product-type-events.ts";
import { applyProductTypeEvent } from "./product-type-fold.ts";
import { INITIAL_PRODUCT_TYPE_STATE } from "./product-type-state.ts";

const BASE_FIELDS = {
  tenantId: "tenant-1",
  streamId: "pt-1",
  streamType: "ProductType" as const,
  correlationId: "corr-1",
  causationId: "corr-1",
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
    payload: {},
    actualTime: new Date("2026-03-01T11:00:00Z"),
    ...overrides,
  };
}

describe("applyProductTypeEvent", () => {
  it("applies ProductTypeCreated", () => {
    const event = makeProductTypeCreatedEvent();
    const state = applyProductTypeEvent(INITIAL_PRODUCT_TYPE_STATE, event);

    expect(state.productTypeId).toBe("pt-1");
    expect(state.name).toBe("Olive Oil");
    expect(state.category).toBe("pantry");
    expect(state.createdAt).toEqual(new Date("2026-03-01T10:00:00Z"));
  });

  it("applies ProductTypeCreated with null category", () => {
    const event = makeProductTypeCreatedEvent({
      payload: { name: "Misc Item", category: null },
    });
    const state = applyProductTypeEvent(INITIAL_PRODUCT_TYPE_STATE, event);

    expect(state.category).toBeNull();
  });

  it("applies ProductTypeUpdated with name change", () => {
    const created = applyProductTypeEvent(
      INITIAL_PRODUCT_TYPE_STATE,
      makeProductTypeCreatedEvent(),
    );
    const state = applyProductTypeEvent(
      created,
      makeProductTypeUpdatedEvent({ payload: { name: "Extra Virgin Olive Oil" } }),
    );

    expect(state.name).toBe("Extra Virgin Olive Oil");
    expect(state.category).toBe("pantry");
  });

  it("applies ProductTypeUpdated with category change", () => {
    const created = applyProductTypeEvent(
      INITIAL_PRODUCT_TYPE_STATE,
      makeProductTypeCreatedEvent(),
    );
    const state = applyProductTypeEvent(
      created,
      makeProductTypeUpdatedEvent({ payload: { category: "cooking" } }),
    );

    expect(state.name).toBe("Olive Oil");
    expect(state.category).toBe("cooking");
  });

  it("applies ProductTypeUpdated clearing category to null", () => {
    const created = applyProductTypeEvent(
      INITIAL_PRODUCT_TYPE_STATE,
      makeProductTypeCreatedEvent(),
    );
    const state = applyProductTypeEvent(
      created,
      makeProductTypeUpdatedEvent({ payload: { category: null } }),
    );

    expect(state.category).toBeNull();
  });

  it("preserves category when not included in update payload", () => {
    const created = applyProductTypeEvent(
      INITIAL_PRODUCT_TYPE_STATE,
      makeProductTypeCreatedEvent(),
    );
    const state = applyProductTypeEvent(
      created,
      makeProductTypeUpdatedEvent({ payload: { name: "New Name" } }),
    );

    expect(state.category).toBe("pantry");
  });
});

describe("buildAggregate (ProductType)", () => {
  it("returns initial state for empty event stream", () => {
    const aggregate = buildAggregate(INITIAL_PRODUCT_TYPE_STATE, [], applyProductTypeEvent);

    expect(aggregate.state).toEqual(INITIAL_PRODUCT_TYPE_STATE);
    expect(aggregate.version).toBe(0);
  });

  it("builds aggregate from create + update", () => {
    const events = [
      makeProductTypeCreatedEvent(),
      makeProductTypeUpdatedEvent({ payload: { name: "EVOO", category: "cooking" } }),
    ];
    const aggregate = buildAggregate(INITIAL_PRODUCT_TYPE_STATE, events, applyProductTypeEvent);

    expect(aggregate.state.name).toBe("EVOO");
    expect(aggregate.state.category).toBe("cooking");
    expect(aggregate.version).toBe(2);
  });
});
