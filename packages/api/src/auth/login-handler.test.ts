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

import { findPrincipalByProviderIdentity } from "./identity-repository.ts";
import { createSession } from "./session-service.ts";

const mockFindPrincipal = vi.mocked(findPrincipalByProviderIdentity);
const mockCreateSession = vi.mocked(createSession);

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

const noop = vi.fn();

describe("loginHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when provider is missing", async () => {
    const handler = loginHandler(makeRegistry(), makePool());
    const { res, status } = makeRes();
    await handler({ body: { credential: "tok" } } as Request, res, noop);
    expect(status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when credential is missing", async () => {
    const handler = loginHandler(makeRegistry(), makePool());
    const { res, status } = makeRes();
    await handler({ body: { provider: "google" } } as Request, res, noop);
    expect(status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for an unknown provider", async () => {
    const registry = makeRegistry({
      verify: vi.fn().mockImplementation(() => {
        throw new UnknownProviderError("github");
      }),
    });
    const handler = loginHandler(registry, makePool());
    const { res, status } = makeRes();
    await handler({ body: { provider: "github", credential: "tok" } } as Request, res, noop);
    expect(status).toHaveBeenCalledWith(400);
  });

  it("returns 401 for a verification failure", async () => {
    const registry = makeRegistry({
      verify: vi.fn().mockRejectedValue(new TokenVerificationError("google", "expired")),
    });
    const handler = loginHandler(registry, makePool());
    const { res, status } = makeRes();
    await handler({ body: { provider: "google", credential: "bad" } } as Request, res, noop);
    expect(status).toHaveBeenCalledWith(401);
  });

  it("returns 401 when user has no identity record", async () => {
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
    await handler({ body: { provider: "google", credential: "tok" } } as Request, res, noop);
    expect(status).toHaveBeenCalledWith(401);
  });

  it("sets cookie and returns 200 on success", async () => {
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

    await handler(
      { body: { provider: "google", credential: "valid-token" } } as Request,
      res,
      noop,
    );

    expect(cookie).toHaveBeenCalledWith("heim_sid", "session-token", expect.any(Object));
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ principal: { id: principalId }, tenant: { id: tenantId } }),
    );
  });
});
