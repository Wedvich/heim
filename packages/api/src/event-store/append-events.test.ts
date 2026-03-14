import { describe, expect, it, vi } from "vitest";
import type { DomainEvent } from "@heim/domain";
import { appendEvents } from "./append-events.ts";
import { makeClient } from "../test-helpers.ts";

describe("appendEvents", () => {
  it("inserts event with correct SQL params", async () => {
    const client = makeClient();
    const mockQuery = vi.mocked(client.query);

    const now = new Date("2026-01-15T12:00:00Z");
    const event: DomainEvent = {
      id: "evt-1",
      tenantId: "tenant-1",
      streamId: "stream-1",
      streamType: "User",
      streamPosition: 1,
      eventType: "UserCreated",
      correlationId: "corr-1",
      causationId: "command:corr-1",
      actingPrincipalId: "principal-1",
      effectivePrincipalId: null,
      payload: { provider: "google", providerSubjectId: "sub-1", merged: false },
      metadata: {},
      actualTime: now,
    };

    await appendEvents(client, [event]);

    expect(mockQuery).toHaveBeenCalledOnce();
    const call = mockQuery.mock.calls[0]! as unknown as [string, unknown[]];
    const [sql, params] = call;
    expect(sql).toContain("INSERT INTO events");
    expect(params).toEqual([
      "evt-1",
      "tenant-1",
      "stream-1",
      "User",
      1,
      "UserCreated",
      "corr-1",
      "command:corr-1",
      "principal-1",
      null,
      JSON.stringify({ provider: "google", providerSubjectId: "sub-1", merged: false }),
      JSON.stringify({}),
      now,
    ]);
  });

  it("inserts multiple events in order", async () => {
    const client = makeClient();
    const mockQuery = vi.mocked(client.query);

    const base: DomainEvent = {
      id: "evt-1",
      tenantId: "t",
      streamId: "s",
      streamType: "User",
      streamPosition: 1,
      eventType: "UserCreated",
      correlationId: "c",
      causationId: "command:c",
      actingPrincipalId: "p",
      effectivePrincipalId: null,
      payload: {},
      metadata: {},
      actualTime: new Date(),
    };

    await appendEvents(client, [base, { ...base, id: "evt-2", streamPosition: 2 }]);

    expect(mockQuery).toHaveBeenCalledTimes(2);
  });
});
