import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerHandler } from "./register-handler.ts";
import { TokenVerificationError } from "./oidc/types.ts";
import { makeClient, makePool, makeReq, makeRes, makeRegistry } from "../test-helpers.ts";

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
    const handler = registerHandler(makeRegistry(), makePool(makeClient()), EMAIL_HMAC_KEY);
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
    const registry = makeRegistry(vi.fn());
    const handler = registerHandler(registry, makePool(makeClient()), EMAIL_HMAC_KEY);
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
    const registry = makeRegistry(
      vi.fn().mockRejectedValue(new TokenVerificationError("google", "expired")),
    );
    const handler = registerHandler(registry, makePool(makeClient()), EMAIL_HMAC_KEY);
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
    const registry = makeRegistry(vi.fn().mockResolvedValue(validIdentity));
    mockFindPrincipal.mockResolvedValue({ principalId: "existing-p" });
    const handler = registerHandler(registry, makePool(makeClient()), EMAIL_HMAC_KEY);
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
    const registry = makeRegistry(vi.fn().mockResolvedValue(validIdentity));
    mockFindPrincipal.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(null);
    mockCreateIdentity.mockResolvedValue({ id: "identity-id" });

    const client = makeClient();
    const mockQuery = vi.mocked(client.query);
    // principal INSERT
    mockQuery.mockResolvedValueOnce({ rows: [] } as never); // BEGIN
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "new-principal" }] } as never); // principal insert

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
    const registry = makeRegistry(vi.fn().mockResolvedValue(validIdentity));
    mockFindPrincipal.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(null);
    mockCreateIdentity.mockResolvedValue({ id: "identity-id" });

    const client = makeClient();
    const mockQuery = vi.mocked(client.query);
    mockQuery
      .mockResolvedValueOnce({ rows: [] } as never) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: "new-principal" }] } as never) // principal insert
      .mockResolvedValueOnce({ rows: [] } as never) // slug check
      .mockResolvedValueOnce({ rows: [{ id: "new-tenant" }] } as never) // tenant insert
      .mockResolvedValueOnce({ rows: [] } as never) // events partition
      .mockResolvedValueOnce({ rows: [] } as never) // forgettable partition
      .mockResolvedValueOnce({ rows: [] } as never) // membership insert
      .mockResolvedValueOnce({ rows: [] } as never) // session insert
      .mockResolvedValueOnce({ rows: [] } as never); // COMMIT

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
    const registry = makeRegistry(vi.fn().mockResolvedValue(validIdentity));
    mockFindPrincipal.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue(null);

    const client = makeClient();
    const mockQuery = vi.mocked(client.query);
    mockQuery.mockResolvedValueOnce({ rows: [] } as never); // BEGIN
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "new-p" }] } as never); // principal

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
    const registry = makeRegistry(vi.fn().mockResolvedValue(validIdentity));
    mockFindPrincipal.mockResolvedValue(null);
    mockFindByEmail.mockResolvedValue({ principalId: "existing-principal" });
    mockCreateIdentity.mockResolvedValue({ id: "identity-id" });

    const client = makeClient();
    const mockQuery = vi.mocked(client.query);
    mockQuery.mockResolvedValueOnce({ rows: [] } as never); // BEGIN

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
    const registry = makeRegistry(vi.fn().mockRejectedValue(new Error("unexpected")));

    const client = makeClient();
    const mockQuery = vi.mocked(client.query);
    mockQuery.mockResolvedValueOnce({ rows: [] } as never); // BEGIN

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
