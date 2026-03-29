import type { SpotKind } from "./room-events.ts";

export interface SpotState {
  readonly spotId: string;
  readonly name: string;
  readonly kind: SpotKind;
  readonly sortOrder: number;
}

export interface RoomState {
  readonly roomId: string | null;
  readonly name: string | null;
  readonly spots: Readonly<Record<string, SpotState>>;
  readonly archived: boolean;
  readonly createdAt: Date | null;
}

export const INITIAL_ROOM_STATE: RoomState = {
  roomId: null,
  name: null,
  spots: {},
  archived: false,
  createdAt: null,
};
