import { Router } from "express";
import { pool } from "../db.ts";
import type { OidcVerifierRegistry } from "../auth/oidc/registry.ts";
import { loginHandler } from "../auth/login-handler.ts";
import { COOKIE_NAME, cookieOptions, invalidateSession } from "../middleware/session.ts";
import { writeAuditLog } from "../audit/audit-logger.ts";

export function createAuthRouter(oidcRegistry: OidcVerifierRegistry): Router {
  const router = Router();

  router.post("/login", loginHandler(oidcRegistry, pool));

  router.post("/logout", async (req, res) => {
    const sid = req.session?.sessionId;
    if (sid) {
      writeAuditLog(pool, {
        principalId: req.session!.principalId,
        tenantId: req.session!.tenantId,
        action: "auth.logout",
        detail: { user_agent: req.requestContext.userAgent },
      });
      await invalidateSession(sid);
    }
    res.clearCookie(COOKIE_NAME, cookieOptions());
    res.json({ ok: true });
  });

  router.get("/session", async (req, res) => {
    if (!req.session) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }

    const { principalId, tenantId, expiresAt } = req.session;

    // Fetch principal type
    const principalResult = await pool.query<{ type: string }>(
      `SELECT type FROM principals WHERE id = $1`,
      [principalId],
    );
    const principal = principalResult.rows[0];
    if (!principal) {
      res.status(401).json({ error: "not_authenticated" });
      return;
    }

    const tenantResult = await pool.query<{
      id: string;
      name: string;
      slug: string;
    }>(`SELECT id, name, slug FROM tenants WHERE id = $1 AND status = 'active'`, [tenantId]);
    const tenant = tenantResult.rows[0] ?? null;

    let membership: { role: string } | null = null;
    if (tenant) {
      const membershipResult = await pool.query<{ role: string }>(
        `SELECT role FROM memberships WHERE principal_id = $1 AND tenant_id = $2`,
        [principalId, tenantId],
      );
      membership = membershipResult.rows[0] ?? null;
    }

    res.json({
      principal: { id: principalId, type: principal.type },
      tenant,
      membership,
      expiresAt: expiresAt.toISOString(),
    });
  });

  return router;
}
