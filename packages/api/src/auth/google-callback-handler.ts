import type { RequestHandler } from "express";
import type { Pool } from "pg";
import type { OidcVerifierRegistry } from "./oidc/registry.ts";
import { TokenVerificationError } from "./oidc/types.ts";
import { findPrincipalByProviderIdentity } from "./identity-repository.ts";
import { createSession } from "./session-service.ts";
import { COOKIE_NAME, cookieOptions, parseCookie } from "../middleware/session.ts";
import { SYSTEM_PRINCIPAL_ID, writeAuditLog } from "../audit/audit-logger.ts";
import { validateReturnTo } from "./validate-return-to.ts";

export function googleCallbackHandler(registry: OidcVerifierRegistry, db: Pool): RequestHandler {
  return async (req, res) => {
    const returnTo = validateReturnTo(req.body?.state);

    try {
      // --- CSRF double-submit check ---
      const cookieHeader = req.headers.cookie;
      const csrfCookie = cookieHeader ? parseCookie(cookieHeader, "g_csrf_token") : undefined;
      const csrfBody = req.body?.g_csrf_token as string | undefined;

      if (!csrfCookie || !csrfBody || csrfCookie !== csrfBody) {
        res.redirect(`/login?error=csrf_failed`);
        return;
      }

      // --- Verify credential ---
      const credential = req.body?.credential as string | undefined;
      if (!credential) {
        res.redirect(`/login?error=invalid_credential`);
        return;
      }

      const detail = { provider: "google", user_agent: req.requestContext.userAgent };

      let identity;
      try {
        identity = await registry.verify("google", credential);
      } catch (err) {
        if (err instanceof TokenVerificationError) {
          console.warn("Token verification failed", { provider: "google", cause: err.cause });
          writeAuditLog(db, {
            principalId: SYSTEM_PRINCIPAL_ID,
            action: "auth.login.failure",
            detail: { ...detail, reason: "token_verification_failed" },
          });
        }
        res.redirect(`/login?error=invalid_credential`);
        return;
      }

      // --- Look up principal & membership ---
      const principal = await findPrincipalByProviderIdentity(
        db,
        identity.provider,
        identity.providerSubjectId,
      );

      if (!principal) {
        writeAuditLog(db, {
          principalId: SYSTEM_PRINCIPAL_ID,
          action: "auth.login.failure",
          detail: { ...detail, reason: "unknown_identity" },
        });
        res.redirect(`/login?error=not_registered`);
        return;
      }

      const membershipResult = await db.query<{ tenant_id: string; role: string }>(
        `SELECT tenant_id, role FROM memberships WHERE principal_id = $1 ORDER BY created_at LIMIT 1`,
        [principal.principalId],
      );
      const membership = membershipResult.rows[0];
      if (!membership) {
        writeAuditLog(db, {
          principalId: principal.principalId,
          action: "auth.login.failure",
          detail: { ...detail, reason: "no_membership" },
        });
        res.redirect(`/login?error=not_registered`);
        return;
      }

      // --- Create session ---
      const token = await createSession(db, principal.principalId, membership.tenant_id);

      writeAuditLog(db, {
        principalId: principal.principalId,
        tenantId: membership.tenant_id,
        action: "auth.login.success",
        detail,
      });

      res.cookie(COOKIE_NAME, token, cookieOptions());
      res.redirect(returnTo);
    } catch (err) {
      console.error("Unexpected error in Google callback handler", err);
      res.redirect(`/login?error=internal`);
    }
  };
}
