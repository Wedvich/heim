import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { lightAuthMiddleware } from "./light-auth.ts";
import type { Pool } from "pg";

function makePool(rows: unknown[] = []) {
  return { query: vi.fn().mockResolvedValue({ rows }) } as unknown as Pool;
}

function makeRes() {
  const json = vi.fn();
  const res = {} as Partial<Response>;
  const status = vi.fn().mockReturnValue(res);
  res.json = json;
  res.status = status as unknown as Response["status"];
  return { res: res as Response, json, status };
}

const next = vi.fn();

describe("lightAuthMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses session when available", async () => {
    const pool = makePool();
    const mw = lightAuthMiddleware(pool);
    const req = {
      session: { principalId: "p-1", tenantId: "t-1", sessionId: "s-1", expiresAt: new Date() },
      headers: {},
    } as unknown as Request;
    const { res } = makeRes();

    await mw(req, res, next);

    expect(req.lightAuth).toEqual({ type: "session", principalId: "p-1", tenantId: "t-1" });
    expect(next).toHaveBeenCalled();
  });

  it("falls back to invite token from Authorization header", async () => {
    const pool = makePool([{ id: "inv-1", tenant_id: "t-1" }]);
    const mw = lightAuthMiddleware(pool);
    const req = {
      session: undefined,
      headers: { authorization: "Bearer some-invite-token" },
    } as unknown as Request;
    const { res } = makeRes();

    await mw(req, res, next);

    expect(req.lightAuth).toEqual({ type: "invite", inviteId: "inv-1", tenantId: "t-1" });
    expect(next).toHaveBeenCalled();
  });

  it("supports null tenantId for create-tenant invites", async () => {
    const pool = makePool([{ id: "inv-2", tenant_id: null }]);
    const mw = lightAuthMiddleware(pool);
    const req = {
      session: undefined,
      headers: { authorization: "Bearer create-token" },
    } as unknown as Request;
    const { res } = makeRes();

    await mw(req, res, next);

    expect(req.lightAuth).toEqual({ type: "invite", inviteId: "inv-2", tenantId: null });
  });

  it("returns 401 when no auth is present", async () => {
    const pool = makePool();
    const mw = lightAuthMiddleware(pool);
    const req = { session: undefined, headers: {} } as unknown as Request;
    const { res, status, json } = makeRes();

    await mw(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: "not_authenticated" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when invite token is invalid", async () => {
    const pool = makePool([]);
    const mw = lightAuthMiddleware(pool);
    const req = {
      session: undefined,
      headers: { authorization: "Bearer bad-token" },
    } as unknown as Request;
    const { res, status } = makeRes();

    await mw(req, res, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
