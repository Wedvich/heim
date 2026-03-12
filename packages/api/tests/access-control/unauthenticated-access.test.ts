import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { requestContextMiddleware } from "../../src/middleware/request-context.ts";
import { sessionMiddleware } from "../../src/middleware/session.ts";
import { createAuthRouter } from "../../src/routes/auth.ts";
import { createTenantsRouter } from "../../src/routes/tenants.ts";
import { OidcVerifierRegistry } from "../../src/auth/oidc/registry.ts";

vi.mock("../../src/db.ts", () => ({
  pool: {
    query: vi.fn().mockRejectedValue(new Error("unexpected DB call")),
  },
}));

function createTestApp() {
  const registry = new OidcVerifierRegistry();
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(requestContextMiddleware);
  app.use(sessionMiddleware);
  app.use("/api/auth", createAuthRouter(registry, "test-hmac-key"));
  app.use("/api/tenants", createTenantsRouter());
  return app;
}

describe("Unauthenticated access", () => {
  it("GET /api/auth/session without cookie returns 401", async () => {
    const app = createTestApp();

    const res = await request(app).get("/api/auth/session");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "not_authenticated" });
  });

  it("POST /api/auth/logout without cookie clears cookie and returns ok", async () => {
    const app = createTestApp();

    const res = await request(app).post("/api/auth/logout");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    expect(String(setCookie)).toMatch(/heim_sid=;/);
  });

  it("GET /api/tenants/slug-available without valid session returns 401", async () => {
    const app = createTestApp();

    const res = await request(app).get("/api/tenants/slug-available?slug=test");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "not_authenticated" });
  });
});
