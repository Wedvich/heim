import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import type { Pool } from "pg";
import type { OidcVerifierRegistry } from "./oidc/registry.ts";
import { TokenVerificationError, UnknownProviderError } from "./oidc/types.ts";
import {
  findPrincipalByProviderIdentity,
  findPrincipalByEmailHash,
  createIdentity,
} from "./identity-repository.ts";
import { findValidInvite, markInviteUsed } from "./invite-repository.ts";
import { hashEmail } from "./email-hash.ts";
import { generateSlug, generateSlugWithSuffix, validateSlug } from "./slug.ts";
import { COOKIE_NAME, cookieOptions } from "../middleware/session.ts";
import { SYSTEM_PRINCIPAL_ID, writeAuditLog } from "../audit/audit-logger.ts";

const SESSION_TTL_DAYS = 30;

export function registerHandler(
  registry: OidcVerifierRegistry,
  db: Pool,
  emailHmacKey: string,
): RequestHandler {
  return async (req, res) => {
    const detail: { provider?: string; user_agent: string } = {
      user_agent: req.requestContext.userAgent,
    };

    try {
      const { provider, credential, inviteToken, tenantName, tenantSlug } = req.body as Record<
        string,
        unknown
      >;

      if (
        typeof provider !== "string" ||
        !provider ||
        typeof credential !== "string" ||
        !credential ||
        typeof inviteToken !== "string" ||
        !inviteToken
      ) {
        res.status(400).json({ error: "invalid_request" });
        return;
      }

      detail.provider = provider;

      const client = await db.connect();
      try {
        await client.query("BEGIN");

        // 1. Validate invite
        const invite = await findValidInvite(client, inviteToken);
        if (!invite) {
          await client.query("ROLLBACK");
          writeAuditLog(db, {
            principalId: SYSTEM_PRINCIPAL_ID,
            action: "auth.register.failure",
            detail: { ...detail, reason: "invalid_invite" },
          });
          res.status(400).json({ error: "invalid_invite" });
          return;
        }

        // 2. Verify OIDC credential
        let identity;
        try {
          identity = await registry.verify(provider, credential);
        } catch (err) {
          await client.query("ROLLBACK");
          if (err instanceof UnknownProviderError) {
            writeAuditLog(db, {
              principalId: SYSTEM_PRINCIPAL_ID,
              action: "auth.register.failure",
              detail: { ...detail, reason: "unknown_provider" },
            });
            res.status(400).json({ error: "unknown_provider" });
            return;
          }
          if (err instanceof TokenVerificationError) {
            req.log.warn({ provider, err }, "Token verification failed");
            writeAuditLog(db, {
              principalId: SYSTEM_PRINCIPAL_ID,
              action: "auth.register.failure",
              detail: { ...detail, reason: "token_verification_failed" },
            });
            res.status(401).json({ error: "verification_failed" });
            return;
          }
          throw err;
        }

        // 3. Check already registered
        const existing = await findPrincipalByProviderIdentity(
          db,
          identity.provider,
          identity.providerSubjectId,
        );
        if (existing) {
          await client.query("ROLLBACK");
          writeAuditLog(db, {
            principalId: existing.principalId,
            action: "auth.register.failure",
            detail: { ...detail, reason: "already_registered" },
          });
          res.status(409).json({ error: "already_registered" });
          return;
        }

        // 4. Email merge or create principal
        let principalId: string;
        let merged = false;
        const emailHash = identity.emailVerified ? hashEmail(identity.email, emailHmacKey) : null;

        if (emailHash) {
          const match = await findPrincipalByEmailHash(client, emailHash);
          if (match) {
            principalId = match.principalId;
            merged = true;
          } else {
            const principalResult = await client.query<{ id: string }>(
              `INSERT INTO principals (type, status) VALUES ('user', 'active') RETURNING id`,
            );
            principalId = principalResult.rows[0]!.id;
          }
        } else {
          const principalResult = await client.query<{ id: string }>(
            `INSERT INTO principals (type, status) VALUES ('user', 'active') RETURNING id`,
          );
          principalId = principalResult.rows[0]!.id;
        }

        // 5. Create identity
        const newIdentity = await createIdentity(client, {
          principalId,
          provider: identity.provider,
          providerSubjectId: identity.providerSubjectId,
          emailHash,
        });

        // 6. Tenant handling
        let tenantId: string;
        if (invite.tenantId) {
          // Join existing tenant
          tenantId = invite.tenantId;
          await client.query(
            `INSERT INTO memberships (principal_id, tenant_id, role) VALUES ($1, $2, $3)`,
            [principalId, tenantId, invite.role],
          );
        } else {
          // Create new tenant
          if (typeof tenantName !== "string" || !tenantName) {
            await client.query("ROLLBACK");
            res.status(400).json({ error: "missing_tenant_name" });
            return;
          }

          let slug: string;
          if (typeof tenantSlug === "string" && tenantSlug) {
            const validation = validateSlug(tenantSlug);
            if (!validation.valid) {
              await client.query("ROLLBACK");
              res.status(400).json({ error: "invalid_slug", reason: validation.reason });
              return;
            }
            slug = tenantSlug;
            const slugCheck = await client.query(`SELECT 1 FROM tenants WHERE slug = $1`, [slug]);
            if (slugCheck.rows.length > 0) {
              await client.query("ROLLBACK");
              res.status(409).json({ error: "slug_taken" });
              return;
            }
          } else {
            // Try the clean base slug first; fall back to suffixed version
            slug = generateSlug(tenantName as string);
            const slugCheck = await client.query(`SELECT 1 FROM tenants WHERE slug = $1`, [slug]);
            if (slugCheck.rows.length > 0) {
              slug = generateSlugWithSuffix(tenantName as string);
            }
          }

          const tenantResult = await client.query<{ id: string }>(
            `INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id`,
            [tenantName, slug],
          );
          tenantId = tenantResult.rows[0]!.id;

          // Create partitions for events and forgettable_payloads
          await client.query(
            `CREATE TABLE IF NOT EXISTS events_${tenantId.replace(/-/g, "_")}
             PARTITION OF events FOR VALUES IN ('${tenantId}')`,
          );
          await client.query(
            `CREATE TABLE IF NOT EXISTS forgettable_payloads_${tenantId.replace(/-/g, "_")}
             PARTITION OF forgettable_payloads FOR VALUES IN ('${tenantId}')`,
          );

          await client.query(
            `INSERT INTO memberships (principal_id, tenant_id, role) VALUES ($1, $2, $3)`,
            [principalId, tenantId, "owner"],
          );
        }

        // 7. Mark invite used
        await markInviteUsed(client, invite.id, principalId);

        // 8. Create session (inline to stay within transaction)
        const sessionToken = randomBytes(32).toString("base64url");
        const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
        await client.query(
          `INSERT INTO sessions (id, principal_id, tenant_id, expires_at) VALUES ($1, $2, $3, $4)`,
          [sessionToken, principalId, tenantId, expiresAt],
        );

        await client.query("COMMIT");

        // 9. Audit logs (fire-and-forget, after commit)
        writeAuditLog(db, {
          principalId,
          tenantId,
          action: "auth.register.success",
          resourceType: "identity",
          resourceId: newIdentity.id,
          detail,
        });

        writeAuditLog(db, {
          principalId,
          tenantId,
          action: "auth.invite.redeemed",
          resourceType: "invite",
          resourceId: invite.id,
          detail: { provider },
        });

        if (merged) {
          writeAuditLog(db, {
            principalId,
            tenantId,
            action: "auth.provider.linked",
            resourceType: "principal",
            resourceId: principalId,
            detail: { provider },
          });
        }

        // 10. Set cookie and respond
        res.cookie(COOKIE_NAME, sessionToken, cookieOptions());
        res.json({ principal: { id: principalId }, tenant: { id: tenantId } });
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      req.log.error({ err }, "Unexpected error in register handler");
      res.status(500).json({ error: "internal_error" });
    }
  };
}
