import type { Command } from "../commands.ts";
import type { SpotKind } from "./room-events.ts";

export interface CreateRoomPayload extends Readonly<Record<string, unknown>> {
  readonly name: string;
}

export interface RenameRoomPayload extends Readonly<Record<string, unknown>> {
  readonly name: string;
}

export interface AddSpotPayload extends Readonly<Record<string, unknown>> {
  readonly spotId: string;
  readonly name: string;
  readonly kind: SpotKind;
  readonly sortOrder: number;
}

export interface RenameSpotPayload extends Readonly<Record<string, unknown>> {
  readonly spotId: string;
  readonly name: string;
}

export interface RemoveSpotPayload extends Readonly<Record<string, unknown>> {
  readonly spotId: string;
}

export type RoomCommandPayload =
  | { readonly type: "CreateRoom"; readonly payload: CreateRoomPayload }
  | { readonly type: "RenameRoom"; readonly payload: RenameRoomPayload }
  | { readonly type: "AddSpot"; readonly payload: AddSpotPayload }
  | { readonly type: "RenameSpot"; readonly payload: RenameSpotPayload }
  | { readonly type: "RemoveSpot"; readonly payload: RemoveSpotPayload }
  | { readonly type: "ArchiveRoom"; readonly payload: Readonly<Record<string, never>> };

export type RoomCommand = Command & RoomCommandPayload;
