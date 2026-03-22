import type { DomainEvent } from "../events.ts";

export const STOCK_ITEM_LEVELS = {
  unopened: "unopened",
  opened: "opened",
  almostEmpty: "almostEmpty",
  empty: "empty",
} as const;

export type StockItemLevel = (typeof STOCK_ITEM_LEVELS)[keyof typeof STOCK_ITEM_LEVELS];

export interface StockItemAddedPayload extends Record<string, unknown> {
  readonly productTypeId: string;
  readonly level: "unopened";
  readonly expiryDate: string | null;
  readonly purchaseDate: string | null;
}

export interface StockItemConsumedPayload extends Record<string, unknown> {
  readonly level: StockItemLevel;
  readonly exactCount: number | null;
}

export interface StockItemLevelCorrectedPayload extends Record<string, unknown> {
  readonly level: StockItemLevel;
  readonly exactCount: number | null;
}

export interface StockItemAddedEvent extends DomainEvent {
  readonly eventType: "StockItemAdded";
  readonly streamType: "StockItem";
  readonly payload: StockItemAddedPayload;
}

export interface StockItemConsumedEvent extends DomainEvent {
  readonly eventType: "StockItemConsumed";
  readonly streamType: "StockItem";
  readonly payload: StockItemConsumedPayload;
}

export interface StockItemLevelCorrectedEvent extends DomainEvent {
  readonly eventType: "StockItemLevelCorrected";
  readonly streamType: "StockItem";
  readonly payload: StockItemLevelCorrectedPayload;
}

export interface StockItemDiscardedEvent extends DomainEvent {
  readonly eventType: "StockItemDiscarded";
  readonly streamType: "StockItem";
  readonly payload: Record<string, unknown>;
}

export type StockItemEvent =
  | StockItemAddedEvent
  | StockItemConsumedEvent
  | StockItemLevelCorrectedEvent
  | StockItemDiscardedEvent;
