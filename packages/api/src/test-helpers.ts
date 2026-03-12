import { vi } from "vitest";
import type { Request, Response } from "express";
import type { Pool, PoolClient } from "pg";
import { OidcVerifierRegistry } from "./auth/oidc/registry.ts";
import type { OidcProviderVerifier } from "./auth/oidc/types.ts";

export function makeRegistry(verify?: OidcProviderVerifier["verify"]): OidcVerifierRegistry {
  const registry = new OidcVerifierRegistry();
  if (verify) {
    registry.register({ providerId: "google", verify });
  }
  return registry;
}

export function makeRes() {
  const json = vi.fn();
  const cookie = vi.fn();
  const res = {} as Partial<Response>;
  const status = vi.fn().mockReturnValue(res);
  res.json = json;
  res.status = status as unknown as Response["status"];
  res.cookie = cookie as unknown as Response["cookie"];
  return { res: res as Response, json, status, cookie };
}

export function makeLog() {
  return {
    fatal: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  };
}

export function makeReq(
  body: Record<string, unknown>,
  overrides?: Record<string, unknown>,
): Request {
  return {
    body,
    log: makeLog(),
    requestContext: { userAgent: "TestAgent/1.0" },
    ...overrides,
  } as unknown as Request;
}

export function makeClient() {
  return {
    query: vi.fn().mockResolvedValue({ rows: [] }),
    release: vi.fn(),
  } as unknown as PoolClient;
}

export function makePool(queryResultOrClient?: { rows: unknown[] } | PoolClient) {
  if (queryResultOrClient && "release" in queryResultOrClient) {
    return {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      connect: vi.fn().mockResolvedValue(queryResultOrClient),
    } as unknown as Pool;
  }
  return {
    query: vi.fn().mockResolvedValue(queryResultOrClient ?? { rows: [] }),
  } as unknown as Pool;
}
