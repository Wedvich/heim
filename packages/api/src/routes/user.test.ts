import { randomBytes } from "node:crypto";
import express from "express";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { LocalKeyManagementService } from "../crypto/kms.ts";
import { encryptPayload } from "../crypto/payload-encryption.ts";
import { makeClient, makePool } from "../test-helpers.ts";
import type { SessionContext } from "../session-context.ts";
import { createUserRouter } from "./user.ts";

const MEK = randomBytes(32).toString("base64");
const kms = new LocalKeyManagementService(MEK);

const SESSION: SessionContext = {
  sessionId: "session-1",
  principalId: "principal-1",
  tenantId: "tenant-1",
  expiresAt: new Date(Date.now() + 3600_000),
};

function makeApp(sessionOverride: SessionContext | null, pool: ReturnType<typeof makePool>) {
  const app = express();
  app.use((req, _res, next) => {
    if (sessionOverride) req.session = sessionOverride;
    next();
  });
  app.use("/api/user", createUserRouter(pool, kms));
  return app;
}

async function makeEncryptedPii(pii: Record<string, unknown>): Promise<{
  encryptedPayload: Buffer;
  encryptedKey: Buffer;
  mekVersion: number;
}> {
  const { plaintextDek, encryptedDek, mekVersion } = await kms.generateDek();
  const encryptedPayload = encryptPayload(Buffer.from(JSON.stringify(pii), "utf8"), plaintextDek);
  return { encryptedPayload, encryptedKey: encryptedDek, mekVersion };
}

function makeEventRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "evt-1",
    tenant_id: "tenant-1",
    stream_id: "principal-1",
    stream_type: "User",
    stream_position: 1,
    event_type: "UserCreated",
    correlation_id: "corr-1",
    causation_id: "command:corr-1",
    acting_principal_id: "principal-1",
    effective_principal_id: null,
    payload: { provider: "google", providerSubjectId: "sub-1", merged: false },
    metadata: {},
    actual_time: new Date("2026-01-15T12:00:00Z"),
    encrypted_payload: null,
    ...overrides,
  };
}

describe("GET /api/user/me/events", () => {
  it("returns 401 when no session", async () => {
    const client = makeClient();
    const pool = makePool(client);
    const app = makeApp(null, pool);

    const res = await supertest(app).get("/api/user/me/events");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "not_authenticated" });
  });

  it("returns events and version for authenticated user", async () => {
    const pii = { email: "alice@example.com", name: "Alice", avatarUrl: "https://img/a" };
    const { encryptedPayload, encryptedKey, mekVersion } = await makeEncryptedPii(pii);

    const client = makeClient();
    const pool = makePool(client);
    const { query } = client as unknown as { query: ReturnType<typeof import("vitest").vi.fn> };

    query
      .mockResolvedValueOnce({ rows: [makeEventRow({ encrypted_payload: encryptedPayload })] })
      .mockResolvedValueOnce({ rows: [{ encrypted_key: encryptedKey, mek_version: mekVersion }] });

    const app = makeApp(SESSION, pool);
    const res = await supertest(app).get("/api/user/me/events");

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(1);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0].eventType).toBe("UserCreated");
    expect(res.body.events[0].pii).toMatchObject(pii);
  });

  it("filters events after afterVersion", async () => {
    const client = makeClient();
    const pool = makePool(client);
    const { query } = client as unknown as { query: ReturnType<typeof import("vitest").vi.fn> };

    query
      .mockResolvedValueOnce({
        rows: [
          makeEventRow({ stream_position: 1 }),
          makeEventRow({ id: "evt-2", stream_position: 2 }),
        ],
      })
      .mockResolvedValueOnce({ rows: [] }); // no key → no pii decryption

    const app = makeApp(SESSION, pool);
    const res = await supertest(app).get("/api/user/me/events?afterVersion=1");

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0].streamPosition).toBe(2);
  });

  it("returns empty events with current version when afterVersion is at head", async () => {
    const client = makeClient();
    const pool = makePool(client);
    const { query } = client as unknown as { query: ReturnType<typeof import("vitest").vi.fn> };

    query
      .mockResolvedValueOnce({ rows: [makeEventRow({ stream_position: 3 })] })
      .mockResolvedValueOnce({ rows: [] });

    const app = makeApp(SESSION, pool);
    const res = await supertest(app).get("/api/user/me/events?afterVersion=3");

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(3);
    expect(res.body.events).toHaveLength(0);
  });

  it("handles crypto-shredded events (pii undefined)", async () => {
    const client = makeClient();
    const pool = makePool(client);
    const { query } = client as unknown as { query: ReturnType<typeof import("vitest").vi.fn> };

    // encrypted_payload present but no key record → pii undefined
    query
      .mockResolvedValueOnce({
        rows: [makeEventRow({ encrypted_payload: Buffer.from("some-encrypted-data") })],
      })
      .mockResolvedValueOnce({ rows: [] }); // no key

    const app = makeApp(SESSION, pool);
    const res = await supertest(app).get("/api/user/me/events");

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0].pii).toBeUndefined();
  });
});
