import { describe, expect, it } from "vitest";
import { autorun } from "mobx";
import type { AggregateSnapshot } from "./api.ts";
import { SyncStore } from "./sync-store.ts";

function makeTenantSnapshot(
  streamId: string,
  state: Record<string, unknown>,
  version: number,
): AggregateSnapshot {
  return { streamId, streamType: "Tenant", version, state };
}

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

  it("populates tenants map from snapshots", () => {
    const store = new SyncStore();
    const snapshots = [
      makeTenantSnapshot(
        "t1",
        {
          tenantId: "t1",
          createdAt: new Date("2025-01-01"),
          name: "Acme",
          slug: "acme",
        },
        1,
      ),
    ];

    store.loadSnapshots(snapshots, "10");

    expect(store.tenants.size).toBe(1);

    const tenant = store.tenants.get("t1")!;
    expect(tenant.name).toBe("Acme");
    expect(tenant.slug).toBe("acme");
    expect(tenant.version).toBe(1);
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

  it("populates productTypes map from snapshots", () => {
    const store = new SyncStore();
    const snapshots: AggregateSnapshot[] = [
      {
        streamId: "pt-1",
        streamType: "ProductType",
        version: 1,
        state: { productTypeId: "pt-1", name: "Olive Oil", category: "pantry", createdAt: null },
      },
    ];

    store.loadSnapshots(snapshots, "10");

    expect(store.productTypes.size).toBe(1);
    const pt = store.productTypes.get("pt-1")!;
    expect(pt.name).toBe("Olive Oil");
    expect(pt.category).toBe("pantry");
    expect(pt.version).toBe(1);
  });

  it("populates stockItems map from snapshots", () => {
    const store = new SyncStore();
    const snapshots: AggregateSnapshot[] = [
      {
        streamId: "si-1",
        streamType: "StockItem",
        version: 2,
        state: {
          stockItemId: "si-1",
          productTypeId: "pt-1",
          level: "opened",
          exactCount: null,
          expiryDate: "2026-06-01",
          purchaseDate: "2026-03-01",
          discarded: false,
          createdAt: null,
        },
      },
    ];

    store.loadSnapshots(snapshots, "10");

    expect(store.stockItems.size).toBe(1);
    const si = store.stockItems.get("si-1")!;
    expect(si.productTypeId).toBe("pt-1");
    expect(si.level).toBe("opened");
    expect(si.expiryDate).toBe("2026-06-01");
    expect(si.discarded).toBe(false);
    expect(si.version).toBe(2);
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
