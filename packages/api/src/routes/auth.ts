import { Router } from "express";
import { pool } from "../db.ts";
import type { OidcVerifierRegistry } from "../auth/oidc/registry.ts";
import type { KeyManagementService } from "../crypto/kms.ts";
import { googleCallbackHandler } from "../auth/google-callback-handler.ts";
import { checkInviteValid } from "../auth/invite-repository.ts";
import { loginHandler } from "../auth/login-handler.ts";
import { registerHandler } from "../auth/register-handler.ts";
import { COOKIE_NAME, cookieOptions, invalidateSession } from "../middleware/session.ts";
import { SYSTEM_PRINCIPAL_ID, writeAuditLog } from "../audit/audit-logger.ts";

export function createAuthRouter(
  oidcRegistry: OidcVerifierRegistry,
  emailHmacKey: string,
  kms: KeyManagementService,
): Router {
  const router = Router();

  router.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  // TODO: Add rate limiting — this unauthenticated endpoint is vulnerable to
  // brute-force / DoS without it. See docs/security.md (A06, A07).
  router.get("/invite-status", async (req, res) => {
    const token = req.query.token;
    if (typeof token !== "string" || !token) {
      res.status(400).json({ error: "missing_token" });
      return;
    }

    const valid = await checkInviteValid(pool, token);

    if (!valid) {
      writeAuditLog(pool, {
        principalId: SYSTEM_PRINCIPAL_ID,
        action: "auth.invite.check_failed",
        detail: { user_agent: req.requestContext.userAgent },
      });
    }

    res.json({ valid });
  });

  router.post("/google/callback", googleCallbackHandler(oidcRegistry, pool, emailHmacKey, kms));
  router.post("/login", loginHandler(oidcRegistry, pool));
  router.post("/register", registerHandler(oidcRegistry, pool, emailHmacKey, kms));

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
