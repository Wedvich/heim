import { describe, expect, it } from "vitest";
import { snapshotsToSeedFile } from "./seed.ts";

function makeSnapshot(streamType: string, streamId: string, state: Record<string, unknown>) {
  return { streamId, streamType, state };
}

describe("snapshotsToSeedFile", () => {
  it("converts ProductType snapshot to CreateProductType command", () => {
    const snapshots = [makeSnapshot("ProductType", "pt-1", { name: "Widget", category: "pantry" })];

    const result = snapshotsToSeedFile(snapshots);

    expect(result.version).toBe(1);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0]).toEqual({
      streamId: "pt-1",
      streamType: "ProductType",
      type: "CreateProductType",
      payload: { name: "Widget", category: "pantry" },
    });
  });

  it("converts StockItem snapshot to AddStockItem command", () => {
    const snapshots = [
      makeSnapshot("StockItem", "si-1", {
        productTypeId: "pt-1",
        level: "full",
        exactCount: 10,
        expiryDate: "2026-06-01",
        purchaseDate: "2026-01-15",
      }),
    ];

    const result = snapshotsToSeedFile(snapshots);

    expect(result.commands).toHaveLength(1);
    expect(result.commands[0]).toEqual({
      streamId: "si-1",
      streamType: "StockItem",
      type: "AddStockItem",
      payload: {
        productTypeId: "pt-1",
        level: "full",
        exactCount: 10,
        expiryDate: "2026-06-01",
        purchaseDate: "2026-01-15",
      },
    });
  });

  it("omits null optional fields from StockItem payload", () => {
    const snapshots = [
      makeSnapshot("StockItem", "si-1", {
        productTypeId: "pt-1",
        level: "full",
        exactCount: null,
        expiryDate: null,
        purchaseDate: null,
      }),
    ];

    const result = snapshotsToSeedFile(snapshots);

    expect(result.commands[0]!.payload).toEqual({
      productTypeId: "pt-1",
      level: "full",
    });
  });

  it("orders ProductType before StockItem by priority", () => {
    const snapshots = [
      makeSnapshot("StockItem", "si-1", { productTypeId: "pt-1", level: "full" }),
      makeSnapshot("ProductType", "pt-1", { name: "Widget" }),
    ];

    const result = snapshotsToSeedFile(snapshots);

    expect(result.commands).toHaveLength(2);
    expect(result.commands[0]!.streamType).toBe("ProductType");
    expect(result.commands[1]!.streamType).toBe("StockItem");
  });

  it("filters by streamTypes option", () => {
    const snapshots = [
      makeSnapshot("ProductType", "pt-1", { name: "Widget" }),
      makeSnapshot("StockItem", "si-1", { productTypeId: "pt-1", level: "full" }),
    ];

    const result = snapshotsToSeedFile(snapshots, { streamTypes: ["ProductType"] });

    expect(result.commands).toHaveLength(1);
    expect(result.commands[0]!.streamType).toBe("ProductType");
  });

  it("excludes Tenant snapshots", () => {
    const snapshots = [
      makeSnapshot("Tenant", "t-1", { name: "Acme" }),
      makeSnapshot("ProductType", "pt-1", { name: "Widget" }),
    ];

    const result = snapshotsToSeedFile(snapshots);

    expect(result.commands).toHaveLength(1);
    expect(result.commands[0]!.streamType).toBe("ProductType");
  });

  it("excludes User snapshots", () => {
    const snapshots = [
      makeSnapshot("User", "u-1", { email: "alice@example.com" }),
      makeSnapshot("ProductType", "pt-1", { name: "Widget" }),
    ];

    const result = snapshotsToSeedFile(snapshots);

    expect(result.commands).toHaveLength(1);
    expect(result.commands[0]!.streamType).toBe("ProductType");
  });

  it("skips unknown stream types with no converter", () => {
    const snapshots = [
      makeSnapshot("UnknownAggregate", "x-1", { foo: "bar" }),
      makeSnapshot("ProductType", "pt-1", { name: "Widget" }),
    ];

    const result = snapshotsToSeedFile(snapshots);

    expect(result.commands).toHaveLength(1);
    expect(result.commands[0]!.streamType).toBe("ProductType");
  });

  it("returns empty commands for empty snapshots", () => {
    const result = snapshotsToSeedFile([]);

    expect(result.version).toBe(1);
    expect(result.commands).toEqual([]);
  });

  it("returns empty commands when all snapshots are excluded types", () => {
    const snapshots = [
      makeSnapshot("Tenant", "t-1", { name: "Acme" }),
      makeSnapshot("User", "u-1", { email: "alice@example.com" }),
    ];

    const result = snapshotsToSeedFile(snapshots);

    expect(result.commands).toEqual([]);
  });
});
