import type { RequestHandler } from "express";
import type { Pool } from "pg";
import type { OidcVerifierRegistry } from "./oidc/registry.ts";
import { TokenVerificationError, UnknownProviderError } from "./oidc/types.ts";
import { findPrincipalByProviderIdentity } from "./identity-repository.ts";
import { createSession } from "./session-service.ts";
import { COOKIE_NAME, cookieOptions } from "../middleware/session.ts";
import { SYSTEM_PRINCIPAL_ID, writeAuditLog } from "../audit/audit-logger.ts";

export function loginHandler(registry: OidcVerifierRegistry, db: Pool): RequestHandler {
  return async (req, res) => {
    try {
      const { provider, credential } = req.body as Record<string, unknown>;

      if (
        typeof provider !== "string" ||
        !provider ||
        typeof credential !== "string" ||
        !credential
      ) {
        res.status(400).json({ error: "invalid_request" });
        return;
      }

      const detail = { provider, user_agent: req.requestContext.userAgent };

      let identity;
      try {
        identity = await registry.verify(provider, credential);
      } catch (err) {
        if (err instanceof UnknownProviderError) {
          writeAuditLog(db, {
            principalId: SYSTEM_PRINCIPAL_ID,
            action: "auth.login.failure",
            detail: { ...detail, reason: "unknown_provider" },
          });
          res.status(400).json({ error: "unknown_provider" });
          return;
        }
        if (err instanceof TokenVerificationError) {
          console.warn("Token verification failed", { provider, cause: err.cause });
          writeAuditLog(db, {
            principalId: SYSTEM_PRINCIPAL_ID,
            action: "auth.login.failure",
            detail: { ...detail, reason: "token_verification_failed" },
          });
          res.status(401).json({ error: "verification_failed" });
          return;
        }
        throw err;
      }

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
        res.status(401).json({ error: "unknown_user" });
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
        res.status(401).json({ error: "no_membership" });
        return;
      }

      const token = await createSession(db, principal.principalId, membership.tenant_id);

      writeAuditLog(db, {
        principalId: principal.principalId,
        tenantId: membership.tenant_id,
        action: "auth.login.success",
        detail,
      });

      res.cookie(COOKIE_NAME, token, cookieOptions());
      res.json({
        principal: { id: principal.principalId },
        tenant: { id: membership.tenant_id },
      });
    } catch (err) {
      console.error("Unexpected error in login handler", err);
      res.status(500).json({ error: "internal_error" });
    }
  };
}
