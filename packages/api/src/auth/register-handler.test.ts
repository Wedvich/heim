import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { registerHandler } from "./register-handler.ts";
import { TokenVerificationError, UnknownProviderError } from "./oidc/types.ts";
import type { OidcVerifierRegistry } from "./oidc/registry.ts";

vi.mock("./identity-repository.ts", () => ({
  findPrincipalByProviderIdentity: vi.fn(),
  findPrincipalByEmailHash: vi.fn(),
  createIdentity: vi.fn(),
}));

vi.mock("./invite-repository.ts", () => ({
  findValidInvite: vi.fn(),
  markInviteUsed: vi.fn(),
}));

vi.mock("../audit/audit-logger.ts", () => ({
  SYSTEM_PRINCIPAL_ID: "00000000-0000-0000-0000-000000000001",
  writeAuditLog: vi.fn(),
}));

import {
  findPrincipalByProviderIdentity,
  findPrincipalByEmailHash,
  createIdentity,
} from "./identity-repository.ts";
import { findValidInvite, markInviteUsed } from "./invite-repository.ts";
import { writeAuditLog } from "../audit/audit-logger.ts";

const mockFindPrincipal = vi.mocked(findPrincipalByProviderIdentity);
const mockFindByEmail = vi.mocked(findPrincipalByEmailHash);
const mockCreateIdentity = vi.mocked(createIdentity);
const mockFindInvite = vi.mocked(findValidInvite);
const mockMarkInviteUsed = vi.mocked(markInviteUsed);
const mockWriteAuditLog = vi.mocked(writeAuditLog);

function makeRegistry(overrides?: { verify?: ReturnType<typeof vi.fn> }): OidcVerifierRegistry {
  return {
    verify: overrides?.verify ?? vi.fn(),
    register: vi.fn(),
    registeredProviders: [],
  } as unknown as OidcVerifierRegistry;
}

function makeClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  };
}

function makePool(client = makeClient()) {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    connect: vi.fn().mockResolvedValue(client),
  } as unknown as import("pg").Pool;
}

function makeRes() {
  const json = vi.fn();
  const cookie = vi.fn();
  const res = {} as Partial<Response>;
  const status = vi.fn().mockReturnValue(res);
  res.json = json;
  res.status = status as unknown as Response["status"];
  res.cookie = cookie as unknown as Response["cookie"];
  return { res: res as Response, json, status, cookie };
}

function makeLog() {
  return {
    fatal: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  };
}

function makeReq(body: Record<string, unknown>): Request {
  return {
    body,
    log: makeLog(),
    requestContext: { userAgent: "TestAgent/1.0" },
  } as unknown as Request;
}

const noop = vi.fn();
const EMAIL_HMAC_KEY = "test-key";

const validIdentity = {
  provider: "google",
  providerSubjectId: "sub-123",
  email: "user@example.com",
  emailVerified: true,
};

const validInvite = {
  id: "invite-id",
  token: "tok",
  tenantId: "tenant-id",
  role: "member",
  createdBy: "p-sys",
  expiresAt: new Date("2030-01-01"),
};

describe("registerHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when inviteToken is missing", async () => {
    const handler = registerHandler(makeRegistry(), makePool(), EMAIL_HMAC_KEY);
    const { res, status } = makeRes();
    await handler(makeReq({ provider: "google", credential: "tok" }), res, noop);
    expect(status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when provider is missing", async () => {
    const handler = registerHandler(makeRegistry(), makePool(), EMAIL_HMAC_KEY);
    const { res, status } = makeRes();
    await handler(makeReq({ credential: "tok", inviteToken: "inv" }), res, noop);
    expect(status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for invalid invite", async () => {
    mockFindInvite.mockResolvedValue(null);
    const handler = registerHandler(makeRegistry(), makePool(), EMAIL_HMAC_KEY);
    const { res, status, json } = makeRes();
    await handler(
      makeReq({ provider: "google", credential: "tok", inviteToken: "bad" }),
      res,
      noop,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: "invalid_invite" });
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "auth.register.failure",
        detail: expect.objectContaining({ reason: "invalid_invite" }),
      }),
    );
  });

  it("returns 400 for unknown provider", async () => {
    mockFindInvite.mockResolvedValue(validInvite);
    const registry = makeRegistry({
      verify: vi.fn().mockRejectedValue(new UnknownProviderError("github")),
    });
    const handler = registerHandler(registry, makePool(), EMAIL_HMAC_KEY);
    const { res, status } = makeRes();
    await handler(
      makeReq({ provider: "github", credential: "tok", inviteToken: "inv" }),
      res,
      noop,
    );
    expect(status).toHaveBeenCalledWith(400);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "auth.register.failure",
        detail: expect.objectContaining({ reason: "unknown_provider" }),
      }),
    );
  });

  it("returns 401 for token verification failure", async () => {
    mockFindInvite.mockResolvedValue(validInvite);
    const registry = makeRegistry({
      verify: vi.fn().mockRejectedValue(new TokenVerificationError("google", "expired")),
    });
    const handler = registerHandler(registry, makePool(), EMAIL_HMAC_KEY);
    const { res, status } = makeRes();
    await handler(
      makeReq({ provider: "google", credential: "bad", inviteToken: "inv" }),
      res,
      noop,
    );
    expect(status).toHaveBeenCalledWith(401);
  });

  it("returns 409 when identity already registered", async () => {
    mockFindInvite.mockResolvedValue(validInvite);
    const registry = makeRegistry({ verify: vi.fn().mockResolvedValue(validIdentity) });
    mockFindPrincipal.mockResolvedValue({ principalId: "existing-p" });
    const handler = registerHandler(registry, makePool(), EMAIL_HMAC_KEY);
    const { res, status, json } = makeRes();
    await handler(
      makeReq({ provider: "google", credential: "tok", inviteToken: "inv" }),
      res,
      noop,
    );
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({ error: "already_registered" });
  });

  it("happy path: joins existing tenant", async () => {
    mockFindInvite.mockResolvedValue(validInvite);
    const registry = makeRegistry({ verify: vi.fn().mockResolvedValue(validIdentity) });
    mockFindPrincipal.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(null);
    mockCreateIdentity.mockResolvedValue({ id: "identity-id" });

    const client = makeClient();
    // principal INSERT
    client.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    client.query.mockResolvedValueOnce({ rows: [{ id: "new-principal" }] }); // principal insert (called by findPrincipalByEmailHash returning null path)

    const pool = makePool(client);
    const handler = registerHandler(registry, pool, EMAIL_HMAC_KEY);
    const { res, json, cookie } = makeRes();

    await handler(
      makeReq({ provider: "google", credential: "tok", inviteToken: "inv" }),
      res,
      noop,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ principal: expect.any(Object), tenant: expect.any(Object) }),
    );
    expect(cookie).toHaveBeenCalledWith("heim_sid", expect.any(String), expect.any(Object));
    expect(mockMarkInviteUsed).toHaveBeenCalled();
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "auth.register.success" }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "auth.invite.redeemed" }),
    );
  });

  it("happy path: creates new tenant", async () => {
    const createTenantInvite = { ...validInvite, tenantId: null };
    mockFindInvite.mockResolvedValue(createTenantInvite);
    const registry = makeRegistry({ verify: vi.fn().mockResolvedValue(validIdentity) });
    mockFindPrincipal.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(null);
    mockCreateIdentity.mockResolvedValue({ id: "identity-id" });

    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: "new-principal" }] }) // principal insert
      .mockResolvedValueOnce({ rows: [] }) // slug check
      .mockResolvedValueOnce({ rows: [{ id: "new-tenant" }] }) // tenant insert
      .mockResolvedValueOnce({ rows: [] }) // events partition
      .mockResolvedValueOnce({ rows: [] }) // forgettable partition
      .mockResolvedValueOnce({ rows: [] }) // membership insert
      .mockResolvedValueOnce({ rows: [] }) // session insert
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const pool = makePool(client);
    const handler = registerHandler(registry, pool, EMAIL_HMAC_KEY);
    const { res, json } = makeRes();

    await handler(
      makeReq({ provider: "google", credential: "tok", inviteToken: "inv", tenantName: "Acme" }),
      res,
      noop,
    );

    expect(json).toHaveBeenCalledWith(expect.objectContaining({ tenant: expect.any(Object) }));
  });

  it("returns 400 when creating tenant without tenantName", async () => {
    const createTenantInvite = { ...validInvite, tenantId: null };
    mockFindInvite.mockResolvedValue(createTenantInvite);
    const registry = makeRegistry({ verify: vi.fn().mockResolvedValue(validIdentity) });
    mockFindPrincipal.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(null);

    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
    client.query.mockResolvedValueOnce({ rows: [{ id: "new-p" }] }); // principal

    const pool = makePool(client);
    const handler = registerHandler(registry, pool, EMAIL_HMAC_KEY);
    const { res, status, json } = makeRes();

    await handler(
      makeReq({ provider: "google", credential: "tok", inviteToken: "inv" }),
      res,
      noop,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: "missing_tenant_name" });
  });

  it("email merge: reuses existing principal", async () => {
    mockFindInvite.mockResolvedValue(validInvite);
    const registry = makeRegistry({ verify: vi.fn().mockResolvedValue(validIdentity) });
    mockFindPrincipal.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue({ principalId: "existing-principal" });
    mockCreateIdentity.mockResolvedValue({ id: "identity-id" });

    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [] }); // BEGIN

    const pool = makePool(client);
    const handler = registerHandler(registry, pool, EMAIL_HMAC_KEY);
    const { res, json } = makeRes();

    await handler(
      makeReq({ provider: "google", credential: "tok", inviteToken: "inv" }),
      res,
      noop,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ principal: { id: "existing-principal" } }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "auth.provider.linked" }),
    );
  });

  it("rolls back on unexpected error", async () => {
    mockFindInvite.mockResolvedValue(validInvite);
    const registry = makeRegistry({
      verify: vi.fn().mockRejectedValue(new Error("unexpected")),
    });

    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [] }); // BEGIN

    const pool = makePool(client);
    const handler = registerHandler(registry, pool, EMAIL_HMAC_KEY);
    const { res, status } = makeRes();

    await handler(
      makeReq({ provider: "google", credential: "tok", inviteToken: "inv" }),
      res,
      noop,
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });
});
