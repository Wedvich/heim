import type { DomainEvent } from "../events.ts";

export const INVENTORY_ITEM_LEVELS = {
  unopened: "unopened",
  opened: "opened",
  almostEmpty: "almostEmpty",
  empty: "empty",
} as const;

export type InventoryItemLevel = (typeof INVENTORY_ITEM_LEVELS)[keyof typeof INVENTORY_ITEM_LEVELS];

export interface InventoryItemAddedPayload extends Record<string, unknown> {
  readonly productTypeId: string;
  readonly level: "unopened";
  readonly expiryDate: string | null;
  readonly purchaseDate: string | null;
}

export interface InventoryItemConsumedPayload extends Record<string, unknown> {
  readonly level: InventoryItemLevel;
  readonly exactCount: number | null;
}

export interface InventoryItemLevelCorrectedPayload extends Record<string, unknown> {
  readonly level: InventoryItemLevel;
  readonly exactCount: number | null;
}

export interface InventoryItemAddedEvent extends DomainEvent {
  readonly eventType: "InventoryItemAdded";
  readonly streamType: "InventoryItem";
  readonly payload: InventoryItemAddedPayload;
}

export interface InventoryItemConsumedEvent extends DomainEvent {
  readonly eventType: "InventoryItemConsumed";
  readonly streamType: "InventoryItem";
  readonly payload: InventoryItemConsumedPayload;
}

export interface InventoryItemLevelCorrectedEvent extends DomainEvent {
  readonly eventType: "InventoryItemLevelCorrected";
  readonly streamType: "InventoryItem";
  readonly payload: InventoryItemLevelCorrectedPayload;
}

export interface InventoryItemDiscardedEvent extends DomainEvent {
  readonly eventType: "InventoryItemDiscarded";
  readonly streamType: "InventoryItem";
  readonly payload: Record<string, unknown>;
}

export type InventoryItemEvent =
  | InventoryItemAddedEvent
  | InventoryItemConsumedEvent
  | InventoryItemLevelCorrectedEvent
  | InventoryItemDiscardedEvent;
