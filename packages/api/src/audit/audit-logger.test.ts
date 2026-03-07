import { afterEach, describe, expect, it, vi } from "vitest";
import { SYSTEM_PRINCIPAL_ID, writeAuditLog } from "./audit-logger.ts";
import type { Pool } from "pg";

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
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Must not throw
    expect(() =>
      writeAuditLog(pool, { principalId: SYSTEM_PRINCIPAL_ID, action: "auth.logout" }),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(consoleSpy).toHaveBeenCalledWith(
      "Audit log write failed",
      expect.any(Error),
      expect.any(Object),
    );
  });
});
