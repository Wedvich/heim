import { describe, expect, it } from "vitest";
import { autorun } from "mobx";
import type { AggregateSnapshot } from "./api.ts";
import { SyncStore } from "./sync-store.ts";

function makeUserSnapshot(
  streamId: string,
  state: Record<string, unknown>,
  version: number,
): AggregateSnapshot {
  return { streamId, streamType: "User", version, state };
}

describe("SyncStore", () => {
  it("populates users map from snapshots", () => {
    const store = new SyncStore();
    const snapshots = [
      makeUserSnapshot(
        "u1",
        {
          principalId: "u1",
          createdAt: new Date("2025-01-01"),
          provider: "google",
          displayName: "Alice",
          email: "alice@example.com",
        },
        3,
      ),
    ];

    store.loadSnapshots(snapshots, "42");

    expect(store.users.size).toBe(1);

    const user = store.users.get("u1")!;
    expect(user.displayName).toBe("Alice");
    expect(user.email).toBe("alice@example.com");
    expect(user.version).toBe(3);
  });

  it("sets cursor from response", () => {
    const store = new SyncStore();
    store.loadSnapshots([], "99");

    expect(store.cursor).toBe("99");
  });

  it("sets status to ready after loading", () => {
    const store = new SyncStore();
    store.loadSnapshots([], "0");

    expect(store.status).toBe("ready");
  });

  it("handles empty snapshots without error", () => {
    const store = new SyncStore();
    store.loadSnapshots([], "0");

    expect(store.users.size).toBe(0);
    expect(store.status).toBe("ready");
  });

  it("silently skips unknown stream types", () => {
    const store = new SyncStore();
    const snapshots: AggregateSnapshot[] = [
      { streamId: "x1", streamType: "UnknownThing", version: 1, state: {} },
      makeUserSnapshot(
        "u1",
        {
          principalId: "u1",
          createdAt: new Date("2025-01-01"),
          provider: "google",
          displayName: "Bob",
        },
        2,
      ),
    ];

    store.loadSnapshots(snapshots, "10");

    expect(store.users.size).toBe(1);
    expect(store.users.get("u1")!.displayName).toBe("Bob");
  });

  it("replaces existing models on second loadSnapshots call", () => {
    const store = new SyncStore();

    store.loadSnapshots(
      [
        makeUserSnapshot(
          "u1",
          {
            principalId: "u1",
            createdAt: new Date("2025-01-01"),
            provider: "google",
            displayName: "Alice v1",
          },
          1,
        ),
      ],
      "10",
    );

    store.loadSnapshots(
      [
        makeUserSnapshot(
          "u1",
          {
            principalId: "u1",
            createdAt: new Date("2025-01-01"),
            provider: "google",
            displayName: "Alice v2",
          },
          5,
        ),
      ],
      "20",
    );

    expect(store.users.size).toBe(1);
    expect(store.users.get("u1")!.displayName).toBe("Alice v2");
    expect(store.users.get("u1")!.version).toBe(5);
    expect(store.cursor).toBe("20");
  });

  it("is observable — MobX reacts to loadSnapshots", () => {
    const store = new SyncStore();
    const observed: string[] = [];

    autorun(() => {
      observed.push(store.status);
    });

    store.loadSnapshots([], "0");

    expect(observed).toEqual(["idle", "ready"]);
  });
});
