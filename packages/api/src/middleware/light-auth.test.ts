import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { lightAuthMiddleware } from "./light-auth.ts";
import { makePool, makeRes } from "../test-helpers.ts";

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
    const pool = makePool({ rows: [{ id: "inv-1", tenant_id: "t-1" }] });
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
    const pool = makePool({ rows: [{ id: "inv-2", tenant_id: null }] });
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
    const pool = makePool({ rows: [] });
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
