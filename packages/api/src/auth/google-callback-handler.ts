import type { RequestHandler } from "express";
import type { Pool } from "pg";
import type { OidcVerifierRegistry } from "./oidc/registry.ts";
import type { KeyManagementService } from "../crypto/kms.ts";
import { TokenVerificationError } from "./oidc/types.ts";
import { findPrincipalByProviderIdentity } from "./identity-repository.ts";
import { getInviteInfo } from "./invite-repository.ts";
import { createSession } from "./session-service.ts";
import { executeRegistrationWithIdentity } from "./register-handler.ts";
import { sealRegistrationToken } from "./registration-token.ts";
import { COOKIE_NAME, cookieOptions, parseCookie } from "../middleware/session.ts";
import { SYSTEM_PRINCIPAL_ID, writeAuditLog } from "../audit/audit-logger.ts";
import { validateReturnTo } from "./validate-return-to.ts";

export const REG_COOKIE_NAME = "heim_reg";
const REG_COOKIE_MAX_AGE_S = 15 * 60; // 15 minutes

interface RegisterState {
  invite: string;
  returnTo?: string;
}

function parseRegisterState(raw: unknown): RegisterState | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.invite !== "string" || !parsed.invite) return null;
    return {
      invite: parsed.invite,
      returnTo: typeof parsed.returnTo === "string" ? parsed.returnTo : undefined,
    };
  } catch {
    return null;
  }
}

export function regCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REG_COOKIE_MAX_AGE_S * 1000,
  };
}

export function googleCallbackHandler(
  registry: OidcVerifierRegistry,
  db: Pool,
  emailHmacKey: string,
  kms: KeyManagementService,
  regTokenSecret: Buffer,
): RequestHandler {
  return async (req, res) => {
    const registerState = parseRegisterState(req.body?.state);
    const isRegister = registerState !== null;
    const returnTo = isRegister
      ? validateReturnTo(registerState.returnTo)
      : validateReturnTo(req.body?.state);

    function redirectError(error: string): void {
      if (isRegister) {
        const params = new URLSearchParams({ error });
        params.set("invite", registerState.invite);
        res.redirect(`/register?${params.toString()}`);
      } else {
        res.redirect(`/login?error=${error}`);
      }
    }

    try {
      // --- CSRF double-submit check ---
      const cookieHeader = req.headers.cookie;
      const csrfCookie = cookieHeader ? parseCookie(cookieHeader, "g_csrf_token") : undefined;
      const csrfBody = req.body?.g_csrf_token as string | undefined;

      if (!csrfCookie || !csrfBody || csrfCookie !== csrfBody) {
        redirectError("csrf_failed");
        return;
      }

      // --- Verify credential ---
      const credential = req.body?.credential as string | undefined;
      if (!credential) {
        redirectError("invalid_credential");
        return;
      }

      const detail = { provider: "google", user_agent: req.requestContext.userAgent };

      if (isRegister) {
        // --- Registration flow ---
        let identity;
        try {
          identity = await registry.verify("google", credential);
        } catch (err) {
          if (err instanceof TokenVerificationError) {
            req.log.warn({ provider: "google", err }, "Token verification failed");
            writeAuditLog(db, {
              principalId: SYSTEM_PRINCIPAL_ID,
              action: "auth.register.failure",
              detail: { ...detail, reason: "token_verification_failed" },
            });
          }
          redirectError("invalid_credential");
          return;
        }

        // Check invite type to decide flow
        const inviteInfo = await getInviteInfo(db, registerState.invite);
        if (!inviteInfo.valid) {
          redirectError("invalid_invite");
          return;
        }

        writeAuditLog(db, {
          principalId: SYSTEM_PRINCIPAL_ID,
          action: "auth.register.google_verified",
          detail,
        });

        if (inviteInfo.tenantId) {
          // Join-tenant invite: complete registration immediately
          const result = await executeRegistrationWithIdentity(
            db,
            emailHmacKey,
            kms,
            identity,
            {
              inviteToken: registerState.invite,
              userAgent: req.requestContext.userAgent,
            },
            req.log,
          );

          if (!result.ok) {
            redirectError(result.error);
            return;
          }

          res.cookie(COOKIE_NAME, result.sessionToken, cookieOptions());
          res.redirect(returnTo);
        } else {
          // Create-tenant invite: seal registration cookie, redirect to setup
          const token = sealRegistrationToken(
            {
              provider: identity.provider,
              providerSubjectId: identity.providerSubjectId,
              email: identity.email,
              emailVerified: identity.emailVerified,
              name: identity.name,
              familyName: identity.familyName,
              avatarUrl: identity.avatarUrl,
              inviteToken: registerState.invite,
              issuedAt: Date.now(),
            },
            regTokenSecret,
          );

          res.cookie(REG_COOKIE_NAME, token, regCookieOptions());
          const setupParams = new URLSearchParams({ invite: registerState.invite });
          res.redirect(`/register/setup?${setupParams.toString()}`);
        }
      } else {
        // --- Login flow ---
        let identity;
        try {
          identity = await registry.verify("google", credential);
        } catch (err) {
          if (err instanceof TokenVerificationError) {
            req.log.warn({ provider: "google", err }, "Token verification failed");
            writeAuditLog(db, {
              principalId: SYSTEM_PRINCIPAL_ID,
              action: "auth.login.failure",
              detail: { ...detail, reason: "token_verification_failed" },
            });
          }
          redirectError("invalid_credential");
          return;
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
          redirectError("not_registered");
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
          redirectError("not_registered");
          return;
        }

        const sessionToken = await createSession(db, principal.principalId, membership.tenant_id);

        writeAuditLog(db, {
          principalId: principal.principalId,
          tenantId: membership.tenant_id,
          action: "auth.login.success",
          detail,
        });

        res.cookie(COOKIE_NAME, sessionToken, cookieOptions());
        res.redirect(returnTo);
      }
    } catch (err) {
      req.log.error({ err }, "Unexpected error in Google callback handler");
      redirectError("internal");
    }
  };
}
