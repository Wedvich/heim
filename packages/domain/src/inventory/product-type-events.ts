import type { DomainEvent } from "../events.ts";

export interface ProductTypeCreatedPayload extends Record<string, unknown> {
  readonly name: string;
  readonly category: string | null;
}

export interface ProductTypeUpdatedPayload extends Record<string, unknown> {
  readonly name?: string;
  readonly category?: string | null;
}

export interface ProductTypeCreatedEvent extends DomainEvent {
  readonly eventType: "ProductTypeCreated";
  readonly streamType: "ProductType";
  readonly payload: ProductTypeCreatedPayload;
}

export interface ProductTypeUpdatedEvent extends DomainEvent {
  readonly eventType: "ProductTypeUpdated";
  readonly streamType: "ProductType";
  readonly payload: ProductTypeUpdatedPayload;
}

export type ProductTypeEvent = ProductTypeCreatedEvent | ProductTypeUpdatedEvent;
