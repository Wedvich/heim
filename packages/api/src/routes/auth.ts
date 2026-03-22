import { Router } from "express";
import { pool } from "../db.ts";
import type { OidcVerifierRegistry } from "../auth/oidc/registry.ts";
import type { VerifiedIdentity } from "../auth/oidc/types.ts";
import type { KeyManagementService } from "../crypto/kms.ts";
import { googleCallbackHandler, REG_COOKIE_NAME } from "../auth/google-callback-handler.ts";
import { getInviteInfo } from "../auth/invite-repository.ts";
import { loginHandler } from "../auth/login-handler.ts";
import { registerHandler, executeRegistrationWithIdentity } from "../auth/register-handler.ts";
import { openRegistrationToken } from "../auth/registration-token.ts";
import {
  COOKIE_NAME,
  cookieOptions,
  invalidateSession,
  parseCookie,
} from "../middleware/session.ts";
import { SYSTEM_PRINCIPAL_ID, writeAuditLog } from "../audit/audit-logger.ts";

const REG_TOKEN_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

export function createAuthRouter(
  oidcRegistry: OidcVerifierRegistry,
  emailHmacKey: string,
  kms: KeyManagementService,
  regTokenSecret: Buffer,
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

    const info = await getInviteInfo(pool, token);

    if (!info.valid) {
      writeAuditLog(pool, {
        principalId: SYSTEM_PRINCIPAL_ID,
        action: "auth.invite.check_failed",
        detail: { user_agent: req.requestContext.userAgent },
      });
    }

    res.json({
      valid: info.valid,
      type: info.tenantId ? "join" : "create",
      tenantName: info.tenantName,
    });
  });

  router.post(
    "/google/callback",
    googleCallbackHandler(oidcRegistry, pool, emailHmacKey, kms, regTokenSecret),
  );
  router.post("/login", loginHandler(oidcRegistry, pool));
  router.post("/register", registerHandler(oidcRegistry, pool, emailHmacKey, kms));

  router.get("/register/context", (req, res) => {
    const cookieHeader = req.headers.cookie;
    const regCookie = cookieHeader ? parseCookie(cookieHeader, REG_COOKIE_NAME) : undefined;

    if (!regCookie) {
      res.status(401).json({ suggestedTenantName: null });
      return;
    }

    const payload = openRegistrationToken(regCookie, regTokenSecret, REG_TOKEN_MAX_AGE_MS);
    if (!payload) {
      res.clearCookie(REG_COOKIE_NAME);
      res.status(401).json({ suggestedTenantName: null });
      return;
    }

    res.json({ suggestedTenantName: payload.familyName ?? null });
  });

  router.post("/register/complete", async (req, res) => {
    try {
      const cookieHeader = req.headers.cookie;
      const regCookie = cookieHeader ? parseCookie(cookieHeader, REG_COOKIE_NAME) : undefined;

      if (!regCookie) {
        res.status(401).json({ error: "registration_expired" });
        return;
      }

      const payload = openRegistrationToken(regCookie, regTokenSecret, REG_TOKEN_MAX_AGE_MS);
      if (!payload) {
        res.clearCookie(REG_COOKIE_NAME);
        res.status(401).json({ error: "registration_expired" });
        return;
      }

      const { tenantName, tenantSlug } = req.body as Record<string, unknown>;
      if (typeof tenantName !== "string" || !tenantName) {
        res.status(400).json({ error: "missing_tenant_name" });
        return;
      }

      const identity: VerifiedIdentity = {
        provider: payload.provider,
        providerSubjectId: payload.providerSubjectId,
        email: payload.email,
        emailVerified: payload.emailVerified,
        name: payload.name,
        familyName: payload.familyName,
        avatarUrl: payload.avatarUrl,
      };

      const result = await executeRegistrationWithIdentity(
        pool,
        emailHmacKey,
        kms,
        identity,
        {
          inviteToken: payload.inviteToken,
          tenantName,
          tenantSlug: typeof tenantSlug === "string" ? tenantSlug : undefined,
          userAgent: req.requestContext.userAgent,
        },
        req.log,
      );

      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      res.clearCookie(REG_COOKIE_NAME);
      res.cookie(COOKIE_NAME, result.sessionToken, cookieOptions());
      res.json({ principal: { id: result.principalId }, tenant: { id: result.tenantId } });
    } catch (err) {
      req.log.error({ err }, "Unexpected error in register/complete handler");
      res.status(500).json({ error: "internal_error" });
    }
  });

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
