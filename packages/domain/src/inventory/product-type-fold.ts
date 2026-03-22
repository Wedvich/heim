import type { ProductTypeEvent } from "./product-type-events.ts";
import type { ProductTypeState } from "./product-type-state.ts";

export function applyProductTypeEvent(
  state: ProductTypeState,
  event: ProductTypeEvent,
): ProductTypeState {
  switch (event.eventType) {
    case "ProductTypeCreated":
      return {
        ...state,
        productTypeId: event.streamId,
        name: event.payload.name,
        category: event.payload.category,
        createdAt: event.actualTime,
      };
    case "ProductTypeUpdated":
      return {
        ...state,
        name: event.payload.name ?? state.name,
        category: event.payload.category !== undefined ? event.payload.category : state.category,
      };
  }
}
