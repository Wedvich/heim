import { computed, makeObservable } from "mobx";
import {
  applyRoomEvent,
  INITIAL_ROOM_STATE,
  type RoomEvent,
  type RoomState,
  type SpotState,
} from "@heim/domain";
import { Model } from "./model.ts";

export class RoomModel extends Model<RoomState, RoomEvent> {
  constructor(
    streamId: string,
    initialState: RoomState = INITIAL_ROOM_STATE,
    initialVersion: number = 0,
  ) {
    super(streamId, "Room", initialState, initialVersion);

    makeObservable(this, {
      name: computed,
      spots: computed,
      archived: computed,
      spotList: computed,
    });
  }

  protected override fold(state: RoomState, event: RoomEvent): RoomState {
    return applyRoomEvent(state, event);
  }

  get name(): string | null {
    return this._state.name;
  }

  get spots(): Readonly<Record<string, SpotState>> {
    return this._state.spots;
  }

  get archived(): boolean {
    return this._state.archived;
  }

  get spotList(): readonly SpotState[] {
    return Object.values(this._state.spots).sort((a, b) => a.sortOrder - b.sortOrder);
  }
}
