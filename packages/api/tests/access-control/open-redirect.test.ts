import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { googleCallbackHandler } from "../../src/auth/google-callback-handler.ts";
import { OidcVerifierRegistry } from "../../src/auth/oidc/registry.ts";
import type { VerifiedIdentity } from "../../src/auth/oidc/types.ts";
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

const { findPrincipalByProviderIdentity } = await import("../../src/auth/identity-repository.ts");
const { createSession } = await import("../../src/auth/session-service.ts");

const csrfToken = "test-csrf-token";
const fakeCredential = "fake-credential";

const verifiedIdentity: VerifiedIdentity = {
  provider: "google",
  providerSubjectId: "google-sub-123",
  email: "user@example.com",
  emailVerified: true,
};

function createTestApp() {
  const verify = vi.fn<(credential: string) => Promise<VerifiedIdentity>>();
  verify.mockResolvedValue(verifiedIdentity);

  const registry = new OidcVerifierRegistry();
  registry.register({ providerId: "google", verify });

  const pool = {
    query: vi.fn().mockResolvedValue({
      rows: [{ tenant_id: "tenant-1", role: "admin" }],
    }),
  } as never;

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(requestContextMiddleware);
  app.post("/api/auth/google/callback", googleCallbackHandler(registry, pool));
  return app;
}

function postCallback(app: express.Express, state: string) {
  return request(app)
    .post("/api/auth/google/callback")
    .set("Cookie", `g_csrf_token=${csrfToken}`)
    .type("form")
    .send({
      g_csrf_token: csrfToken,
      credential: fakeCredential,
      state,
    });
}

describe("Open redirect protection on Google callback", () => {
  beforeEach(() => {
    vi.mocked(findPrincipalByProviderIdentity).mockResolvedValue({
      principalId: "principal-1",
    });
    vi.mocked(createSession).mockResolvedValue("session-token");
  });

  it('redirects to "/" when state is an absolute URL', async () => {
    const app = createTestApp();

    const res = await postCallback(app, "https://evil.com");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
  });

  it('redirects to "/" when state is a protocol-relative URL', async () => {
    const app = createTestApp();

    const res = await postCallback(app, "//evil.com");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
  });

  it('redirects to "/dashboard" when state is a valid relative path', async () => {
    const app = createTestApp();

    const res = await postCallback(app, "/dashboard");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/dashboard");
  });

  it('redirects to "/" when state is empty', async () => {
    const app = createTestApp();

    const res = await postCallback(app, "");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
  });
});
