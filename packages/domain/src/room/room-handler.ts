import type { Command, CommandHandler, DecisionResult } from "../commands.ts";
import { SPOT_KINDS } from "./room-events.ts";
import type { RoomCommand } from "./room-commands.ts";
import type { RoomState } from "./room-state.ts";

const MAX_NAME_LENGTH = 100;

function validateName(raw: string): { ok: true; name: string } | { ok: false; reason: string } {
  const name = raw.trim();
  if (name.length === 0) {
    return { ok: false, reason: "Name must not be empty" };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { ok: false, reason: `Name must not exceed ${MAX_NAME_LENGTH} characters` };
  }
  return { ok: true, name };
}

export const roomHandler: CommandHandler<RoomState> = {
  streamType: "Room",

  handle(state: RoomState, command: Command): DecisionResult {
    const cmd = command as RoomCommand;

    switch (cmd.type) {
      case "CreateRoom": {
        if (state.roomId !== null) {
          return { ok: false, reason: "Room already exists" };
        }
        const v = validateName(cmd.payload.name);
        if (!v.ok) return { ok: false, reason: v.reason };
        return {
          ok: true,
          events: [{ eventType: "RoomCreated", payload: { name: v.name } }],
        };
      }

      case "RenameRoom": {
        if (state.roomId === null) {
          return { ok: false, reason: "Room does not exist" };
        }
        if (state.archived) {
          return { ok: false, reason: "Cannot rename an archived room" };
        }
        const v = validateName(cmd.payload.name);
        if (!v.ok) return { ok: false, reason: v.reason };
        if (v.name === state.name) {
          return { ok: true, events: [] };
        }
        return {
          ok: true,
          events: [{ eventType: "RoomRenamed", payload: { name: v.name } }],
        };
      }

      case "AddSpot": {
        if (state.roomId === null) {
          return { ok: false, reason: "Room does not exist" };
        }
        if (state.archived) {
          return { ok: false, reason: "Cannot add spot to an archived room" };
        }
        const v = validateName(cmd.payload.name);
        if (!v.ok) return { ok: false, reason: v.reason };
        if (state.spots[cmd.payload.spotId]) {
          return { ok: false, reason: "Spot ID already exists" };
        }
        const duplicateName = Object.values(state.spots).some((s) => s.name === v.name);
        if (duplicateName) {
          return { ok: false, reason: "A spot with this name already exists" };
        }
        if (!(cmd.payload.kind in SPOT_KINDS)) {
          return { ok: false, reason: `Invalid spot kind: ${cmd.payload.kind}` };
        }
        return {
          ok: true,
          events: [
            {
              eventType: "SpotAdded",
              payload: {
                spotId: cmd.payload.spotId,
                name: v.name,
                kind: cmd.payload.kind,
                sortOrder: cmd.payload.sortOrder,
              },
            },
          ],
        };
      }

      case "RenameSpot": {
        if (state.roomId === null) {
          return { ok: false, reason: "Room does not exist" };
        }
        if (state.archived) {
          return { ok: false, reason: "Cannot rename spot in an archived room" };
        }
        const spot = state.spots[cmd.payload.spotId];
        if (!spot) {
          return { ok: false, reason: "Spot does not exist" };
        }
        const v = validateName(cmd.payload.name);
        if (!v.ok) return { ok: false, reason: v.reason };
        if (v.name === spot.name) {
          return { ok: true, events: [] };
        }
        const duplicateName = Object.values(state.spots).some(
          (s) => s.spotId !== cmd.payload.spotId && s.name === v.name,
        );
        if (duplicateName) {
          return { ok: false, reason: "A spot with this name already exists" };
        }
        return {
          ok: true,
          events: [
            {
              eventType: "SpotRenamed",
              payload: { spotId: cmd.payload.spotId, name: v.name },
            },
          ],
        };
      }

      case "RemoveSpot": {
        if (state.roomId === null) {
          return { ok: false, reason: "Room does not exist" };
        }
        if (state.archived) {
          return { ok: false, reason: "Cannot remove spot from an archived room" };
        }
        if (!state.spots[cmd.payload.spotId]) {
          return { ok: false, reason: "Spot does not exist" };
        }
        return {
          ok: true,
          events: [
            {
              eventType: "SpotRemoved",
              payload: { spotId: cmd.payload.spotId },
            },
          ],
        };
      }

      case "ArchiveRoom": {
        if (state.roomId === null) {
          return { ok: false, reason: "Room does not exist" };
        }
        if (state.archived) {
          return { ok: true, events: [] };
        }
        return {
          ok: true,
          events: [{ eventType: "RoomArchived", payload: {} }],
        };
      }

      default:
        return { ok: false, reason: `Unknown command type: ${(command as Command).type}` };
    }
  },
};
