import { describe, expect, it } from "vitest";
import { buildAggregate } from "../aggregate.ts";
import type {
  RoomArchivedEvent,
  RoomCreatedEvent,
  RoomRenamedEvent,
  SpotAddedEvent,
  SpotRemovedEvent,
  SpotRenamedEvent,
} from "./room-events.ts";
import { applyRoomEvent } from "./room-fold.ts";
import { INITIAL_ROOM_STATE } from "./room-state.ts";

const BASE_FIELDS = {
  tenantId: "tenant-1",
  streamId: "room-1",
  streamType: "Room" as const,
  correlationId: "corr-1",
  causationId: "corr-1",
  actingPrincipalId: "principal-1",
  effectivePrincipalId: null,
  metadata: {},
};

function makeRoomCreatedEvent(overrides?: Partial<RoomCreatedEvent>): RoomCreatedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-1",
    streamPosition: 1,
    eventType: "RoomCreated",
    payload: { name: "Kitchen" },
    actualTime: new Date("2026-03-01T10:00:00Z"),
    ...overrides,
  };
}

function makeRoomRenamedEvent(overrides?: Partial<RoomRenamedEvent>): RoomRenamedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-2",
    streamPosition: 2,
    eventType: "RoomRenamed",
    payload: { name: "Main Kitchen" },
    actualTime: new Date("2026-03-02T10:00:00Z"),
    ...overrides,
  };
}

function makeSpotAddedEvent(overrides?: Partial<SpotAddedEvent>): SpotAddedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-3",
    streamPosition: 3,
    eventType: "SpotAdded",
    payload: { spotId: "spot-1", name: "Fridge", kind: "appliance", sortOrder: 0 },
    actualTime: new Date("2026-03-03T10:00:00Z"),
    ...overrides,
  };
}

function makeSpotRenamedEvent(overrides?: Partial<SpotRenamedEvent>): SpotRenamedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-4",
    streamPosition: 4,
    eventType: "SpotRenamed",
    payload: { spotId: "spot-1", name: "Main Fridge" },
    actualTime: new Date("2026-03-04T10:00:00Z"),
    ...overrides,
  };
}

function makeSpotRemovedEvent(overrides?: Partial<SpotRemovedEvent>): SpotRemovedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-5",
    streamPosition: 5,
    eventType: "SpotRemoved",
    payload: { spotId: "spot-1" },
    actualTime: new Date("2026-03-05T10:00:00Z"),
    ...overrides,
  };
}

function makeRoomArchivedEvent(overrides?: Partial<RoomArchivedEvent>): RoomArchivedEvent {
  return {
    ...BASE_FIELDS,
    id: "evt-6",
    streamPosition: 6,
    eventType: "RoomArchived",
    payload: {},
    actualTime: new Date("2026-03-06T10:00:00Z"),
    ...overrides,
  };
}

describe("applyRoomEvent", () => {
  it("applies RoomCreated", () => {
    const state = applyRoomEvent(INITIAL_ROOM_STATE, makeRoomCreatedEvent());

    expect(state.roomId).toBe("room-1");
    expect(state.name).toBe("Kitchen");
    expect(state.createdAt).toEqual(new Date("2026-03-01T10:00:00Z"));
    expect(state.archived).toBe(false);
    expect(state.spots).toEqual({});
  });

  it("applies RoomRenamed", () => {
    const created = applyRoomEvent(INITIAL_ROOM_STATE, makeRoomCreatedEvent());
    const state = applyRoomEvent(created, makeRoomRenamedEvent());

    expect(state.name).toBe("Main Kitchen");
  });

  it("applies SpotAdded", () => {
    const created = applyRoomEvent(INITIAL_ROOM_STATE, makeRoomCreatedEvent());
    const state = applyRoomEvent(created, makeSpotAddedEvent());

    expect(state.spots["spot-1"]).toEqual({
      spotId: "spot-1",
      name: "Fridge",
      kind: "appliance",
      sortOrder: 0,
    });
  });

  it("applies SpotRenamed", () => {
    const created = applyRoomEvent(INITIAL_ROOM_STATE, makeRoomCreatedEvent());
    const withSpot = applyRoomEvent(created, makeSpotAddedEvent());
    const state = applyRoomEvent(withSpot, makeSpotRenamedEvent());

    expect(state.spots["spot-1"]!.name).toBe("Main Fridge");
    expect(state.spots["spot-1"]!.kind).toBe("appliance");
  });

  it("applies SpotRemoved", () => {
    const created = applyRoomEvent(INITIAL_ROOM_STATE, makeRoomCreatedEvent());
    const withSpot = applyRoomEvent(created, makeSpotAddedEvent());
    const state = applyRoomEvent(withSpot, makeSpotRemovedEvent({ streamPosition: 3 }));

    expect(state.spots["spot-1"]).toBeUndefined();
    expect(Object.keys(state.spots)).toHaveLength(0);
  });

  it("applies RoomArchived", () => {
    const created = applyRoomEvent(INITIAL_ROOM_STATE, makeRoomCreatedEvent());
    const state = applyRoomEvent(created, makeRoomArchivedEvent({ streamPosition: 2 }));

    expect(state.archived).toBe(true);
  });
});

describe("buildAggregate (Room)", () => {
  it("returns initial state for empty event stream", () => {
    const aggregate = buildAggregate(INITIAL_ROOM_STATE, [], applyRoomEvent);

    expect(aggregate.state).toEqual(INITIAL_ROOM_STATE);
    expect(aggregate.version).toBe(0);
  });

  it("full lifecycle: create → add spots → rename spot → remove spot → archive", () => {
    const events = [
      makeRoomCreatedEvent(),
      makeSpotAddedEvent(),
      makeSpotAddedEvent({
        id: "evt-3b",
        streamPosition: 3,
        payload: { spotId: "spot-2", name: "Pantry", kind: "storage", sortOrder: 1 },
      }),
      makeSpotRenamedEvent(),
      makeSpotRemovedEvent({ payload: { spotId: "spot-2" } }),
      makeRoomArchivedEvent(),
    ];
    const aggregate = buildAggregate(INITIAL_ROOM_STATE, events, applyRoomEvent);

    expect(aggregate.state.name).toBe("Kitchen");
    expect(aggregate.state.archived).toBe(true);
    expect(Object.keys(aggregate.state.spots)).toHaveLength(1);
    expect(aggregate.state.spots["spot-1"]!.name).toBe("Main Fridge");
    expect(aggregate.version).toBe(6);
  });
});
