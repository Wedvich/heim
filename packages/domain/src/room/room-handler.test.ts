import { describe, expect, it } from "vitest";
import type { Command } from "../commands.ts";
import { roomHandler } from "./room-handler.ts";
import { INITIAL_ROOM_STATE, type RoomState } from "./room-state.ts";

function makeCommand(overrides?: Partial<Command>): Command {
  return {
    commandId: "cmd-1",
    correlationId: "corr-1",
    causationId: "corr-1",
    streamId: "room-1",
    streamType: "Room",
    type: "CreateRoom",
    payload: { name: "Kitchen" },
    expectedVersion: 0,
    actualTime: new Date("2026-03-01T10:00:00Z"),
    tenantId: "tenant-1",
    actingPrincipalId: "principal-1",
    effectivePrincipalId: null,
    ...overrides,
  };
}

const EXISTING: RoomState = {
  roomId: "room-1",
  name: "Kitchen",
  spots: {},
  archived: false,
  createdAt: new Date("2026-03-01T10:00:00Z"),
};

const ARCHIVED: RoomState = {
  ...EXISTING,
  archived: true,
};

const WITH_SPOTS: RoomState = {
  ...EXISTING,
  spots: {
    "spot-1": { spotId: "spot-1", name: "Fridge", kind: "appliance", sortOrder: 0 },
    "spot-2": { spotId: "spot-2", name: "Pantry", kind: "storage", sortOrder: 1 },
  },
};

describe("roomHandler", () => {
  describe("CreateRoom", () => {
    it("produces RoomCreated event on empty state", () => {
      const result = roomHandler.handle(INITIAL_ROOM_STATE, makeCommand());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        eventType: "RoomCreated",
        payload: { name: "Kitchen" },
      });
    });

    it("trims the name", () => {
      const result = roomHandler.handle(
        INITIAL_ROOM_STATE,
        makeCommand({ payload: { name: "  Kitchen  " } }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events[0]!.payload).toEqual({ name: "Kitchen" });
    });

    it("rejects empty name", () => {
      const result = roomHandler.handle(
        INITIAL_ROOM_STATE,
        makeCommand({ payload: { name: "   " } }),
      );

      expect(result).toEqual({ ok: false, reason: "Name must not be empty" });
    });

    it("rejects name exceeding max length", () => {
      const result = roomHandler.handle(
        INITIAL_ROOM_STATE,
        makeCommand({ payload: { name: "a".repeat(101) } }),
      );

      expect(result).toEqual({ ok: false, reason: "Name must not exceed 100 characters" });
    });

    it("rejects when room already exists", () => {
      const result = roomHandler.handle(EXISTING, makeCommand());

      expect(result).toEqual({ ok: false, reason: "Room already exists" });
    });
  });

  describe("RenameRoom", () => {
    it("produces RoomRenamed event", () => {
      const result = roomHandler.handle(
        EXISTING,
        makeCommand({ type: "RenameRoom", payload: { name: "Main Kitchen" }, expectedVersion: 1 }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        eventType: "RoomRenamed",
        payload: { name: "Main Kitchen" },
      });
    });

    it("no-op when name is unchanged", () => {
      const result = roomHandler.handle(
        EXISTING,
        makeCommand({ type: "RenameRoom", payload: { name: "Kitchen" }, expectedVersion: 1 }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(0);
    });

    it("rejects when room does not exist", () => {
      const result = roomHandler.handle(
        INITIAL_ROOM_STATE,
        makeCommand({ type: "RenameRoom", payload: { name: "Kitchen" } }),
      );

      expect(result).toEqual({ ok: false, reason: "Room does not exist" });
    });

    it("rejects on archived room", () => {
      const result = roomHandler.handle(
        ARCHIVED,
        makeCommand({ type: "RenameRoom", payload: { name: "New" }, expectedVersion: 1 }),
      );

      expect(result).toEqual({ ok: false, reason: "Cannot rename an archived room" });
    });
  });

  describe("AddSpot", () => {
    it("produces SpotAdded event", () => {
      const result = roomHandler.handle(
        EXISTING,
        makeCommand({
          type: "AddSpot",
          payload: { spotId: "spot-1", name: "Fridge", kind: "appliance", sortOrder: 0 },
          expectedVersion: 1,
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        eventType: "SpotAdded",
        payload: { spotId: "spot-1", name: "Fridge", kind: "appliance", sortOrder: 0 },
      });
    });

    it("rejects duplicate spot ID", () => {
      const result = roomHandler.handle(
        WITH_SPOTS,
        makeCommand({
          type: "AddSpot",
          payload: { spotId: "spot-1", name: "New Spot", kind: "storage", sortOrder: 2 },
          expectedVersion: 1,
        }),
      );

      expect(result).toEqual({ ok: false, reason: "Spot ID already exists" });
    });

    it("rejects duplicate spot name", () => {
      const result = roomHandler.handle(
        WITH_SPOTS,
        makeCommand({
          type: "AddSpot",
          payload: { spotId: "spot-3", name: "Fridge", kind: "storage", sortOrder: 2 },
          expectedVersion: 1,
        }),
      );

      expect(result).toEqual({ ok: false, reason: "A spot with this name already exists" });
    });

    it("rejects invalid spot kind", () => {
      const result = roomHandler.handle(
        EXISTING,
        makeCommand({
          type: "AddSpot",
          payload: { spotId: "spot-1", name: "Fridge", kind: "invalid", sortOrder: 0 },
          expectedVersion: 1,
        }),
      );

      expect(result).toEqual({ ok: false, reason: "Invalid spot kind: invalid" });
    });

    it("rejects when room does not exist", () => {
      const result = roomHandler.handle(
        INITIAL_ROOM_STATE,
        makeCommand({
          type: "AddSpot",
          payload: { spotId: "spot-1", name: "Fridge", kind: "appliance", sortOrder: 0 },
        }),
      );

      expect(result).toEqual({ ok: false, reason: "Room does not exist" });
    });

    it("rejects on archived room", () => {
      const result = roomHandler.handle(
        ARCHIVED,
        makeCommand({
          type: "AddSpot",
          payload: { spotId: "spot-1", name: "Fridge", kind: "appliance", sortOrder: 0 },
          expectedVersion: 1,
        }),
      );

      expect(result).toEqual({ ok: false, reason: "Cannot add spot to an archived room" });
    });
  });

  describe("RenameSpot", () => {
    it("produces SpotRenamed event", () => {
      const result = roomHandler.handle(
        WITH_SPOTS,
        makeCommand({
          type: "RenameSpot",
          payload: { spotId: "spot-1", name: "Main Fridge" },
          expectedVersion: 1,
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        eventType: "SpotRenamed",
        payload: { spotId: "spot-1", name: "Main Fridge" },
      });
    });

    it("no-op when name is unchanged", () => {
      const result = roomHandler.handle(
        WITH_SPOTS,
        makeCommand({
          type: "RenameSpot",
          payload: { spotId: "spot-1", name: "Fridge" },
          expectedVersion: 1,
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(0);
    });

    it("rejects when spot does not exist", () => {
      const result = roomHandler.handle(
        EXISTING,
        makeCommand({
          type: "RenameSpot",
          payload: { spotId: "spot-99", name: "Foo" },
          expectedVersion: 1,
        }),
      );

      expect(result).toEqual({ ok: false, reason: "Spot does not exist" });
    });

    it("rejects duplicate name from different spot", () => {
      const result = roomHandler.handle(
        WITH_SPOTS,
        makeCommand({
          type: "RenameSpot",
          payload: { spotId: "spot-1", name: "Pantry" },
          expectedVersion: 1,
        }),
      );

      expect(result).toEqual({ ok: false, reason: "A spot with this name already exists" });
    });

    it("rejects when room does not exist", () => {
      const result = roomHandler.handle(
        INITIAL_ROOM_STATE,
        makeCommand({
          type: "RenameSpot",
          payload: { spotId: "spot-1", name: "Foo" },
        }),
      );

      expect(result).toEqual({ ok: false, reason: "Room does not exist" });
    });

    it("rejects on archived room", () => {
      const result = roomHandler.handle(
        ARCHIVED,
        makeCommand({
          type: "RenameSpot",
          payload: { spotId: "spot-1", name: "Foo" },
          expectedVersion: 1,
        }),
      );

      expect(result).toEqual({ ok: false, reason: "Cannot rename spot in an archived room" });
    });
  });

  describe("RemoveSpot", () => {
    it("produces SpotRemoved event", () => {
      const result = roomHandler.handle(
        WITH_SPOTS,
        makeCommand({
          type: "RemoveSpot",
          payload: { spotId: "spot-1" },
          expectedVersion: 1,
        }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        eventType: "SpotRemoved",
        payload: { spotId: "spot-1" },
      });
    });

    it("rejects when spot does not exist", () => {
      const result = roomHandler.handle(
        EXISTING,
        makeCommand({
          type: "RemoveSpot",
          payload: { spotId: "spot-99" },
          expectedVersion: 1,
        }),
      );

      expect(result).toEqual({ ok: false, reason: "Spot does not exist" });
    });

    it("rejects when room does not exist", () => {
      const result = roomHandler.handle(
        INITIAL_ROOM_STATE,
        makeCommand({
          type: "RemoveSpot",
          payload: { spotId: "spot-1" },
        }),
      );

      expect(result).toEqual({ ok: false, reason: "Room does not exist" });
    });

    it("rejects on archived room", () => {
      const result = roomHandler.handle(
        ARCHIVED,
        makeCommand({
          type: "RemoveSpot",
          payload: { spotId: "spot-1" },
          expectedVersion: 1,
        }),
      );

      expect(result).toEqual({ ok: false, reason: "Cannot remove spot from an archived room" });
    });
  });

  describe("ArchiveRoom", () => {
    it("produces RoomArchived event", () => {
      const result = roomHandler.handle(
        EXISTING,
        makeCommand({ type: "ArchiveRoom", payload: {}, expectedVersion: 1 }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        eventType: "RoomArchived",
        payload: {},
      });
    });

    it("no-op when already archived", () => {
      const result = roomHandler.handle(
        ARCHIVED,
        makeCommand({ type: "ArchiveRoom", payload: {}, expectedVersion: 1 }),
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.events).toHaveLength(0);
    });

    it("rejects when room does not exist", () => {
      const result = roomHandler.handle(
        INITIAL_ROOM_STATE,
        makeCommand({ type: "ArchiveRoom", payload: {} }),
      );

      expect(result).toEqual({ ok: false, reason: "Room does not exist" });
    });
  });

  it("rejects unknown command type", () => {
    const result = roomHandler.handle(INITIAL_ROOM_STATE, makeCommand({ type: "MoveRoom" }));

    expect(result).toEqual({ ok: false, reason: "Unknown command type: MoveRoom" });
  });
});
