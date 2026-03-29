import type { RoomEvent } from "./room-events.ts";
import type { RoomState } from "./room-state.ts";

export function applyRoomEvent(state: RoomState, event: RoomEvent): RoomState {
  switch (event.eventType) {
    case "RoomCreated":
      return {
        ...state,
        roomId: event.streamId,
        name: event.payload.name,
        createdAt: event.actualTime,
      };
    case "RoomRenamed":
      return {
        ...state,
        name: event.payload.name,
      };
    case "SpotAdded":
      return {
        ...state,
        spots: {
          ...state.spots,
          [event.payload.spotId]: {
            spotId: event.payload.spotId,
            name: event.payload.name,
            kind: event.payload.kind,
            sortOrder: event.payload.sortOrder,
          },
        },
      };
    case "SpotRenamed":
      return {
        ...state,
        spots: {
          ...state.spots,
          [event.payload.spotId]: {
            ...state.spots[event.payload.spotId]!,
            name: event.payload.name,
          },
        },
      };
    case "SpotRemoved": {
      const { [event.payload.spotId]: _, ...rest } = state.spots;
      return {
        ...state,
        spots: rest,
      };
    }
    case "RoomArchived":
      return { ...state, archived: true };
  }
}
