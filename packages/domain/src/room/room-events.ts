import type { DomainEvent } from "../events.ts";

export const SPOT_KINDS = {
  storage: "storage",
  fixture: "fixture",
  appliance: "appliance",
} as const;

export type SpotKind = (typeof SPOT_KINDS)[keyof typeof SPOT_KINDS];

export interface RoomCreatedPayload extends Record<string, unknown> {
  readonly name: string;
}

export interface RoomRenamedPayload extends Record<string, unknown> {
  readonly name: string;
}

export interface SpotAddedPayload extends Record<string, unknown> {
  readonly spotId: string;
  readonly name: string;
  readonly kind: SpotKind;
  readonly sortOrder: number;
}

export interface SpotRenamedPayload extends Record<string, unknown> {
  readonly spotId: string;
  readonly name: string;
}

export interface SpotRemovedPayload extends Record<string, unknown> {
  readonly spotId: string;
}

export interface RoomCreatedEvent extends DomainEvent {
  readonly eventType: "RoomCreated";
  readonly streamType: "Room";
  readonly payload: RoomCreatedPayload;
}

export interface RoomRenamedEvent extends DomainEvent {
  readonly eventType: "RoomRenamed";
  readonly streamType: "Room";
  readonly payload: RoomRenamedPayload;
}

export interface SpotAddedEvent extends DomainEvent {
  readonly eventType: "SpotAdded";
  readonly streamType: "Room";
  readonly payload: SpotAddedPayload;
}

export interface SpotRenamedEvent extends DomainEvent {
  readonly eventType: "SpotRenamed";
  readonly streamType: "Room";
  readonly payload: SpotRenamedPayload;
}

export interface SpotRemovedEvent extends DomainEvent {
  readonly eventType: "SpotRemoved";
  readonly streamType: "Room";
  readonly payload: SpotRemovedPayload;
}

export interface RoomArchivedEvent extends DomainEvent {
  readonly eventType: "RoomArchived";
  readonly streamType: "Room";
  readonly payload: Record<string, unknown>;
}

export type RoomEvent =
  | RoomCreatedEvent
  | RoomRenamedEvent
  | SpotAddedEvent
  | SpotRenamedEvent
  | SpotRemovedEvent
  | RoomArchivedEvent;
