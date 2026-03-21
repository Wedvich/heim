import { randomBytes } from "node:crypto";
import express from "express";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { LocalKeyManagementService } from "../crypto/kms.ts";
import { encryptPayload } from "../crypto/payload-encryption.ts";
import { makeClient, makePool } from "../test-helpers.ts";
import type { SessionContext } from "../session-context.ts";
import { createSyncRouter } from "./sync.ts";

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
    if (sessionOverride) {
      req.session = sessionOverride;
      req.tenantContext = { tenantId: sessionOverride.tenantId, role: "owner" };
    }
    next();
  });
  app.use("/api/sync", createSyncRouter(pool, kms));
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

function makeTenantEventRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "evt-1",
    tenant_id: "tenant-1",
    stream_id: "principal-1",
    stream_type: "User",
    stream_position: 1,
    global_position: "100",
    event_type: "UserCreated",
    correlation_id: "corr-1",
    causation_id: "command:corr-1",
    acting_principal_id: "principal-1",
    effective_principal_id: null,
    payload: { provider: "google", providerSubjectId: "sub-1", merged: false },
    metadata: {},
    actual_time: new Date("2026-01-15T12:00:00Z"),
    encrypted_payload: null,
    fp_principal_id: null,
    encrypted_key: null,
    mek_version: null,
    ...overrides,
  };
}

describe("GET /api/sync/bootstrap", () => {
  it("returns 401 when no session", async () => {
    const client = makeClient();
    const pool = makePool(client);
    const app = makeApp(null, pool);

    const res = await supertest(app).get("/api/sync/bootstrap");

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "not_authenticated" });
  });

  it("returns empty snapshots and cursor '0' for empty tenant", async () => {
    const client = makeClient();
    const pool = makePool(client);

    const app = makeApp(SESSION, pool);
    const res = await supertest(app).get("/api/sync/bootstrap");

    expect(res.status).toBe(200);
    expect(res.body.snapshots).toEqual([]);
    expect(res.body.cursor).toBe("0");
  });

  it("returns folded User snapshot with PII", async () => {
    const pii = { email: "alice@example.com", name: "Alice", avatarUrl: "https://img/a" };
    const { encryptedPayload, encryptedKey, mekVersion } = await makeEncryptedPii(pii);

    const client = makeClient();
    const pool = makePool(client);
    const { query } = client as unknown as { query: ReturnType<typeof import("vitest").vi.fn> };

    query.mockResolvedValueOnce({
      rows: [
        makeTenantEventRow({
          encrypted_payload: encryptedPayload,
          fp_principal_id: "principal-1",
          encrypted_key: encryptedKey,
          mek_version: mekVersion,
        }),
      ],
    });

    const app = makeApp(SESSION, pool);
    const res = await supertest(app).get("/api/sync/bootstrap");

    expect(res.status).toBe(200);
    expect(res.body.snapshots).toHaveLength(1);
    expect(res.body.snapshots[0]).toMatchObject({
      streamId: "principal-1",
      streamType: "User",
      version: 1,
    });
    expect(res.body.snapshots[0].state).toMatchObject({
      principalId: "principal-1",
      provider: "google",
      displayName: "Alice",
      email: "alice@example.com",
      avatarUrl: "https://img/a",
    });
    expect(res.body.cursor).toBe("100");
  });

  it("returns multiple snapshots for multiple streams", async () => {
    const pii1 = { email: "alice@example.com", name: "Alice" };
    const pii2 = { email: "bob@example.com", name: "Bob" };

    const { plaintextDek: dek1, encryptedDek: encKey1, mekVersion: mek1 } = await kms.generateDek();
    const { plaintextDek: dek2, encryptedDek: encKey2, mekVersion: mek2 } = await kms.generateDek();

    const enc1 = encryptPayload(Buffer.from(JSON.stringify(pii1), "utf8"), dek1);
    const enc2 = encryptPayload(Buffer.from(JSON.stringify(pii2), "utf8"), dek2);

    const client = makeClient();
    const pool = makePool(client);
    const { query } = client as unknown as { query: ReturnType<typeof import("vitest").vi.fn> };

    query.mockResolvedValueOnce({
      rows: [
        makeTenantEventRow({
          encrypted_payload: enc1,
          fp_principal_id: "principal-1",
          encrypted_key: encKey1,
          mek_version: mek1,
        }),
        makeTenantEventRow({
          id: "evt-2",
          stream_id: "principal-2",
          stream_position: 1,
          global_position: "101",
          encrypted_payload: enc2,
          fp_principal_id: "principal-2",
          encrypted_key: encKey2,
          mek_version: mek2,
        }),
      ],
    });

    const app = makeApp(SESSION, pool);
    const res = await supertest(app).get("/api/sync/bootstrap");

    expect(res.status).toBe(200);
    expect(res.body.snapshots).toHaveLength(2);

    const ids = res.body.snapshots.map((s: { streamId: string }) => s.streamId);
    expect(ids).toContain("principal-1");
    expect(ids).toContain("principal-2");
    expect(res.body.cursor).toBe("101");
  });

  it("handles crypto-shredded events (PII undefined in state)", async () => {
    const client = makeClient();
    const pool = makePool(client);
    const { query } = client as unknown as { query: ReturnType<typeof import("vitest").vi.fn> };

    query.mockResolvedValueOnce({
      rows: [
        makeTenantEventRow({
          encrypted_payload: Buffer.from("shredded"),
          fp_principal_id: "principal-1",
          encrypted_key: null,
          mek_version: null,
        }),
      ],
    });

    const app = makeApp(SESSION, pool);
    const res = await supertest(app).get("/api/sync/bootstrap");

    expect(res.status).toBe(200);
    expect(res.body.snapshots).toHaveLength(1);
    expect(res.body.snapshots[0].state.displayName).toBeUndefined();
    expect(res.body.snapshots[0].state.email).toBeUndefined();
    expect(res.body.cursor).toBe("100");
  });

  it("cursor is max global_position", async () => {
    const client = makeClient();
    const pool = makePool(client);
    const { query } = client as unknown as { query: ReturnType<typeof import("vitest").vi.fn> };

    query.mockResolvedValueOnce({
      rows: [
        makeTenantEventRow({ global_position: "50" }),
        makeTenantEventRow({
          id: "evt-2",
          stream_position: 2,
          global_position: "200",
        }),
      ],
    });

    const app = makeApp(SESSION, pool);
    const res = await supertest(app).get("/api/sync/bootstrap");

    expect(res.status).toBe(200);
    expect(res.body.cursor).toBe("200");
  });

  it("skips unknown stream types", async () => {
    const client = makeClient();
    const pool = makePool(client);
    const { query } = client as unknown as { query: ReturnType<typeof import("vitest").vi.fn> };

    query.mockResolvedValueOnce({
      rows: [makeTenantEventRow({ stream_type: "UnknownType", stream_id: "unknown-1" })],
    });

    const app = makeApp(SESSION, pool);
    const res = await supertest(app).get("/api/sync/bootstrap");

    expect(res.status).toBe(200);
    expect(res.body.snapshots).toEqual([]);
    expect(res.body.cursor).toBe("100");
  });
});
