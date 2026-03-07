import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { loginHandler } from "./login-handler.ts";
import { TokenVerificationError, UnknownProviderError } from "./oidc/types.ts";
import type { OidcVerifierRegistry } from "./oidc/registry.ts";

vi.mock("./identity-repository.ts", () => ({
  findPrincipalByProviderIdentity: vi.fn(),
}));

vi.mock("./session-service.ts", () => ({
  createSession: vi.fn(),
}));

vi.mock("../audit/audit-logger.ts", () => ({
  SYSTEM_PRINCIPAL_ID: "00000000-0000-0000-0000-000000000001",
  writeAuditLog: vi.fn(),
}));

import { findPrincipalByProviderIdentity } from "./identity-repository.ts";
import { createSession } from "./session-service.ts";
import { writeAuditLog, SYSTEM_PRINCIPAL_ID } from "../audit/audit-logger.ts";

const mockFindPrincipal = vi.mocked(findPrincipalByProviderIdentity);
const mockCreateSession = vi.mocked(createSession);
const mockWriteAuditLog = vi.mocked(writeAuditLog);

function makeRegistry(overrides?: { verify?: ReturnType<typeof vi.fn> }): OidcVerifierRegistry {
  return {
    verify: overrides?.verify ?? vi.fn(),
    register: vi.fn(),
    registeredProviders: [],
  } as unknown as OidcVerifierRegistry;
}

function makePool(queryResult?: { rows: unknown[] }) {
  return {
    query: vi.fn().mockResolvedValue(queryResult ?? { rows: [] }),
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

function makeReq(body: Record<string, unknown>): Request {
  return {
    body,
    requestContext: { userAgent: "TestAgent/1.0" },
  } as unknown as Request;
}

const noop = vi.fn();

describe("loginHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when provider is missing", async () => {
    const handler = loginHandler(makeRegistry(), makePool());
    const { res, status } = makeRes();
    await handler(makeReq({ credential: "tok" }), res, noop);
    expect(status).toHaveBeenCalledWith(400);
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("returns 400 when credential is missing", async () => {
    const handler = loginHandler(makeRegistry(), makePool());
    const { res, status } = makeRes();
    await handler(makeReq({ provider: "google" }), res, noop);
    expect(status).toHaveBeenCalledWith(400);
    expect(mockWriteAuditLog).not.toHaveBeenCalled();
  });

  it("returns 400 for an unknown provider and writes audit log", async () => {
    const registry = makeRegistry({
      verify: vi.fn().mockImplementation(() => {
        throw new UnknownProviderError("github");
      }),
    });
    const handler = loginHandler(registry, makePool());
    const { res, status } = makeRes();
    await handler(makeReq({ provider: "github", credential: "tok" }), res, noop);
    expect(status).toHaveBeenCalledWith(400);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        principalId: SYSTEM_PRINCIPAL_ID,
        action: "auth.login.failure",
        detail: expect.objectContaining({ reason: "unknown_provider", provider: "github" }),
      }),
    );
  });

  it("returns 401 for a verification failure and writes audit log", async () => {
    const registry = makeRegistry({
      verify: vi.fn().mockRejectedValue(new TokenVerificationError("google", "expired")),
    });
    const handler = loginHandler(registry, makePool());
    const { res, status } = makeRes();
    await handler(makeReq({ provider: "google", credential: "bad" }), res, noop);
    expect(status).toHaveBeenCalledWith(401);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        principalId: SYSTEM_PRINCIPAL_ID,
        action: "auth.login.failure",
        detail: expect.objectContaining({ reason: "token_verification_failed" }),
      }),
    );
  });

  it("returns 401 when user has no identity record and writes audit log", async () => {
    const registry = makeRegistry({
      verify: vi.fn().mockResolvedValue({
        provider: "google",
        providerSubjectId: "sub-123",
        email: "user@example.com",
        emailVerified: true,
      }),
    });
    mockFindPrincipal.mockResolvedValue(null);
    const handler = loginHandler(registry, makePool());
    const { res, status } = makeRes();
    await handler(makeReq({ provider: "google", credential: "tok" }), res, noop);
    expect(status).toHaveBeenCalledWith(401);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        principalId: SYSTEM_PRINCIPAL_ID,
        action: "auth.login.failure",
        detail: expect.objectContaining({ reason: "unknown_identity" }),
      }),
    );
  });

  it("returns 401 when user has no membership and writes audit log", async () => {
    const principalId = "principal-uuid";
    const registry = makeRegistry({
      verify: vi.fn().mockResolvedValue({
        provider: "google",
        providerSubjectId: "sub-123",
        email: "user@example.com",
        emailVerified: true,
      }),
    });
    mockFindPrincipal.mockResolvedValue({ principalId });
    const handler = loginHandler(registry, makePool({ rows: [] }));
    const { res, status } = makeRes();
    await handler(makeReq({ provider: "google", credential: "tok" }), res, noop);
    expect(status).toHaveBeenCalledWith(401);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        principalId,
        action: "auth.login.failure",
        detail: expect.objectContaining({ reason: "no_membership" }),
      }),
    );
  });

  it("sets cookie, returns 200 on success, and writes audit log", async () => {
    const principalId = "principal-uuid";
    const tenantId = "tenant-uuid";
    const registry = makeRegistry({
      verify: vi.fn().mockResolvedValue({
        provider: "google",
        providerSubjectId: "sub-123",
        email: "user@example.com",
        emailVerified: true,
      }),
    });
    mockFindPrincipal.mockResolvedValue({ principalId });
    mockCreateSession.mockResolvedValue("session-token");
    const pool = makePool({ rows: [{ tenant_id: tenantId, role: "admin" }] });
    const handler = loginHandler(registry, pool);
    const { res, json, cookie } = makeRes();

    await handler(makeReq({ provider: "google", credential: "valid-token" }), res, noop);

    expect(cookie).toHaveBeenCalledWith("heim_sid", "session-token", expect.any(Object));
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ principal: { id: principalId }, tenant: { id: tenantId } }),
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        principalId,
        tenantId,
        action: "auth.login.success",
      }),
    );
  });
});
