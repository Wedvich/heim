import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { googleCallbackHandler } from "../../src/auth/google-callback-handler.ts";
import { OidcVerifierRegistry } from "../../src/auth/oidc/registry.ts";
import type { OidcProviderVerifier } from "../../src/auth/oidc/types.ts";
import { requestContextMiddleware } from "../../src/middleware/request-context.ts";

vi.mock("../../src/auth/identity-repository.ts", () => ({
  findPrincipalByProviderIdentity: vi.fn(),
}));

vi.mock("../../src/auth/session-service.ts", () => ({
  createSession: vi.fn(),
}));

vi.mock("../../src/audit/audit-logger.ts", () => ({
  SYSTEM_PRINCIPAL_ID: "00000000-0000-0000-0000-000000000000",
  writeAuditLog: vi.fn(),
}));

function createTestApp(verifyFn: OidcProviderVerifier["verify"]) {
  const registry = new OidcVerifierRegistry();
  registry.register({ providerId: "google", verify: verifyFn });

  const pool = {} as never;
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(requestContextMiddleware);
  app.post("/api/auth/google/callback", googleCallbackHandler(registry, pool));
  return { app, registry };
}

describe("CSRF enforcement on Google callback", () => {
  const csrfToken = "test-csrf-token-abc";

  it("redirects to /login?error=csrf_failed when g_csrf_token cookie is missing", async () => {
    const verify = vi.fn();
    const { app } = createTestApp(verify);

    const res = await request(app)
      .post("/api/auth/google/callback")
      .type("form")
      .send({ g_csrf_token: csrfToken, credential: "fake" });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login?error=csrf_failed");
    expect(verify).not.toHaveBeenCalled();
  });

  it("redirects to /login?error=csrf_failed when g_csrf_token body field is missing", async () => {
    const verify = vi.fn();
    const { app } = createTestApp(verify);

    const res = await request(app)
      .post("/api/auth/google/callback")
      .set("Cookie", `g_csrf_token=${csrfToken}`)
      .type("form")
      .send({ credential: "fake" });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login?error=csrf_failed");
    expect(verify).not.toHaveBeenCalled();
  });

  it("redirects to /login?error=csrf_failed when cookie and body tokens mismatch", async () => {
    const verify = vi.fn();
    const { app } = createTestApp(verify);

    const res = await request(app)
      .post("/api/auth/google/callback")
      .set("Cookie", `g_csrf_token=${csrfToken}`)
      .type("form")
      .send({ g_csrf_token: "different-token", credential: "fake" });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login?error=csrf_failed");
    expect(verify).not.toHaveBeenCalled();
  });

  it("proceeds to credential verification when tokens match", async () => {
    const verify = vi.fn().mockRejectedValue(new Error("test: not a real token"));
    const { app } = createTestApp(verify);

    const res = await request(app)
      .post("/api/auth/google/callback")
      .set("Cookie", `g_csrf_token=${csrfToken}`)
      .type("form")
      .send({ g_csrf_token: csrfToken, credential: "fake-credential" });

    // The handler proceeds past CSRF and calls verify, which rejects.
    // The outer catch redirects to /login?error=internal (unrecognized error type).
    expect(res.status).toBe(302);
    expect(verify).toHaveBeenCalledWith("fake-credential");
  });
});
