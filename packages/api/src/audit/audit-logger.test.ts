import { afterEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_PRINCIPAL_ID, writeAuditLog } from "./audit-logger.ts";
import type { Pool } from "pg";

vi.mock("../logger.ts", async () => {
  const { Writable } = await import("node:stream");
  const pino = (await import("pino")).default;

  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _encoding, cb) {
      chunks.push(chunk);
      cb();
    },
  });

  return {
    logger: Object.assign(pino({ level: "debug" }, stream), {
      _chunks: chunks,
    }),
  };
});

import { logger } from "../logger.ts";

function drainCapturedLines(): Record<string, unknown>[] {
  const chunks = (logger as unknown as { _chunks: Buffer[] })._chunks;
  const raw = Buffer.concat(chunks).toString();
  chunks.length = 0;
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function makePool(reject = false) {
  const query = reject
    ? vi.fn().mockReturnValue(Promise.reject(new Error("db error")))
    : vi.fn().mockReturnValue(Promise.resolve({ rows: [] }));
  return { query } as unknown as Pool;
}

describe("writeAuditLog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inserts a row with correct parameters", async () => {
    const pool = makePool();
    writeAuditLog(pool, {
      principalId: SYSTEM_PRINCIPAL_ID,
      action: "auth.login.failure",
      detail: { provider: "google", reason: "unknown_identity" },
    });
    // Allow the fire-and-forget promise to settle
    await new Promise((r) => setTimeout(r, 0));
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO audit_log"), [
      SYSTEM_PRINCIPAL_ID,
      null,
      "auth.login.failure",
      null,
      null,
      expect.any(String),
    ]);
  });

  it("includes resourceType and resourceId when provided", async () => {
    const pool = makePool();
    writeAuditLog(pool, {
      principalId: "p-1",
      tenantId: "t-1",
      action: "auth.login.success",
      resourceType: "session",
      resourceId: "sess-token",
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      "p-1",
      "t-1",
      "auth.login.success",
      "session",
      "sess-token",
      "{}",
    ]);
  });

  it("is fire-and-forget: db errors are caught and logged, not thrown", async () => {
    const pool = makePool(true);
    // Must not throw
    expect(() =>
      writeAuditLog(pool, { principalId: SYSTEM_PRINCIPAL_ID, action: "auth.logout" }),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    const lines = drainCapturedLines();
    const errorLine = lines.find((l) => l.level === 50);
    expect(errorLine).toBeDefined();
    expect(errorLine!.msg).toBe("Audit log write failed");
  });
});
