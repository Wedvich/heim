import { describe, expect, it, vi } from "vitest";
import { loadStreamEvents } from "./load-stream-events.ts";
import { makeClient } from "../test-helpers.ts";

describe("loadStreamEvents", () => {
  it("queries events by tenant and stream, ordered by position", async () => {
    const client = makeClient();
    const mockQuery = vi.mocked(client.query);
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);

    await loadStreamEvents(client, "tenant-1", "stream-1");

    const call = mockQuery.mock.calls[0]! as unknown as [string, unknown[]];
    expect(call[0]).toContain("FROM events");
    expect(call[0]).toContain("WHERE tenant_id = $1 AND stream_id = $2");
    expect(call[0]).toContain("ORDER BY stream_position");
    expect(call[1]).toEqual(["tenant-1", "stream-1"]);
  });

  it("maps rows to DomainEvent objects", async () => {
    const client = makeClient();
    const mockQuery = vi.mocked(client.query);
    const now = new Date("2026-03-01T10:00:00Z");

    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "evt-1",
          tenant_id: "tenant-1",
          stream_id: "pt-1",
          stream_type: "ProductType",
          stream_position: 1,
          event_type: "ProductTypeCreated",
          correlation_id: "corr-1",
          causation_id: "command:cmd-1",
          acting_principal_id: "principal-1",
          effective_principal_id: null,
          payload: { name: "Olive Oil", category: "pantry" },
          metadata: {},
          actual_time: now,
        },
      ],
    } as never);

    const events = await loadStreamEvents(client, "tenant-1", "pt-1");

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      id: "evt-1",
      tenantId: "tenant-1",
      streamId: "pt-1",
      streamType: "ProductType",
      streamPosition: 1,
      eventType: "ProductTypeCreated",
      correlationId: "corr-1",
      causationId: "command:cmd-1",
      actingPrincipalId: "principal-1",
      effectivePrincipalId: null,
      payload: { name: "Olive Oil", category: "pantry" },
      metadata: {},
      actualTime: now,
    });
  });

  it("returns empty array when no events exist", async () => {
    const client = makeClient();
    vi.mocked(client.query).mockResolvedValueOnce({ rows: [] } as never);

    const events = await loadStreamEvents(client, "tenant-1", "nonexistent");

    expect(events).toEqual([]);
  });
});
