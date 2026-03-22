import { randomBytes } from "node:crypto";
import { v7 as uuidv7 } from "uuid";
import type { RequestHandler } from "express";
import type { Pool } from "pg";
import type { Logger } from "pino";
import type { MemberAddedEvent, TenantCreatedEvent, UserCreatedEvent } from "@heim/domain";
import type { OidcVerifierRegistry } from "./oidc/registry.ts";
import type { VerifiedIdentity } from "./oidc/types.ts";
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
import type { KeyManagementService } from "../crypto/kms.ts";
import {
  createForgettablePayloadKey,
  getForgettablePayloadKey,
} from "../crypto/forgettable-payload-key-repository.ts";
import { appendEvents } from "../event-store/append-events.ts";
import { storeForgettablePayload } from "../event-store/store-forgettable-payload.ts";

const SESSION_TTL_DAYS = 30;

export interface RegisterParams {
  provider: string;
  credential: string;
  inviteToken: string;
  tenantName?: string;
  tenantSlug?: string;
  userAgent: string;
}

export interface RegisterWithIdentityParams {
  inviteToken: string;
  tenantName?: string;
  tenantSlug?: string;
  userAgent: string;
}

export type RegisterResult =
  | { ok: true; sessionToken: string; principalId: string; tenantId: string }
  | { ok: false; error: string; status: number };

/**
 * Executes registration with an already-verified identity.
 * Used by both the single-step flow (credential verified inline) and the
 * multi-step flow (credential verified earlier, claims carried in heim_reg cookie).
 */
export async function executeRegistrationWithIdentity(
  db: Pool,
  emailHmacKey: string,
  kms: KeyManagementService,
  identity: VerifiedIdentity,
  params: RegisterWithIdentityParams,
  _log: Logger,
): Promise<RegisterResult> {
  const { inviteToken, tenantName, tenantSlug, userAgent } = params;
  const detail: { provider: string; user_agent: string } = {
    provider: identity.provider,
    user_agent: userAgent,
  };

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
      return { ok: false, error: "invalid_invite", status: 400 };
    }

    // 2. Check already registered
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
      return { ok: false, error: "already_registered", status: 409 };
    }

    // 3. Email merge or create principal
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

    // 4. Create identity
    const newIdentity = await createIdentity(client, {
      principalId,
      provider: identity.provider,
      providerSubjectId: identity.providerSubjectId,
      emailHash,
    });

    // 5. Tenant handling
    const correlationId = uuidv7();
    let tenantCreatedEvent: TenantCreatedEvent | null = null;
    let memberAddedEvent: MemberAddedEvent | null = null;
    let tenantId: string;
    if (invite.tenantId) {
      // Join existing tenant
      tenantId = invite.tenantId;
      await client.query(
        `INSERT INTO memberships (principal_id, tenant_id, role) VALUES ($1, $2, $3)`,
        [principalId, tenantId, invite.role],
      );

      const posResult = await client.query<{ next_pos: number }>(
        `SELECT COALESCE(MAX(stream_position), 0) + 1 AS next_pos
         FROM events WHERE tenant_id = $1 AND stream_id = $1 AND stream_type = 'Tenant'`,
        [tenantId],
      );
      memberAddedEvent = {
        id: uuidv7(),
        tenantId,
        streamId: tenantId,
        streamType: "Tenant",
        streamPosition: posResult.rows[0]!.next_pos,
        eventType: "MemberAdded",
        correlationId,
        causationId: `command:${correlationId}`,
        actingPrincipalId: principalId,
        effectivePrincipalId: null,
        payload: { principalId, role: invite.role },
        metadata: {},
        actualTime: new Date(),
      };
    } else {
      // Create new tenant
      if (typeof tenantName !== "string" || !tenantName) {
        await client.query("ROLLBACK");
        return { ok: false, error: "missing_tenant_name", status: 400 };
      }

      let slug: string;
      if (typeof tenantSlug === "string" && tenantSlug) {
        const validation = validateSlug(tenantSlug);
        if (!validation.valid) {
          await client.query("ROLLBACK");
          return { ok: false, error: "invalid_slug", status: 400 };
        }
        slug = tenantSlug;
        const slugCheck = await client.query(`SELECT 1 FROM tenants WHERE slug = $1`, [slug]);
        if (slugCheck.rows.length > 0) {
          await client.query("ROLLBACK");
          return { ok: false, error: "slug_taken", status: 409 };
        }
      } else {
        slug = generateSlug(tenantName);
        const slugCheck = await client.query(`SELECT 1 FROM tenants WHERE slug = $1`, [slug]);
        if (slugCheck.rows.length > 0) {
          slug = generateSlugWithSuffix(tenantName);
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

      const now = new Date();
      tenantCreatedEvent = {
        id: uuidv7(),
        tenantId,
        streamId: tenantId,
        streamType: "Tenant",
        streamPosition: 1,
        eventType: "TenantCreated",
        correlationId,
        causationId: `command:${correlationId}`,
        actingPrincipalId: principalId,
        effectivePrincipalId: null,
        payload: {
          name: tenantName,
          slug,
          createdByPrincipalId: principalId,
        },
        metadata: {},
        actualTime: now,
      };

      memberAddedEvent = {
        id: uuidv7(),
        tenantId,
        streamId: tenantId,
        streamType: "Tenant",
        streamPosition: 2,
        eventType: "MemberAdded",
        correlationId,
        causationId: `command:${correlationId}`,
        actingPrincipalId: principalId,
        effectivePrincipalId: null,
        payload: { principalId, role: "owner" },
        metadata: {},
        actualTime: now,
      };
    }

    // 6. Mark invite used
    await markInviteUsed(client, invite.id, principalId);

    // 7. Co-write UserCreated event with forgettable payload
    let plaintextDek: Buffer;
    if (merged) {
      const existingKey = await getForgettablePayloadKey(client, principalId);
      if (existingKey) {
        plaintextDek = await kms.decryptDek(existingKey.encryptedKey, existingKey.mekVersion);
      } else {
        const generated = await kms.generateDek();
        plaintextDek = generated.plaintextDek;
        await createForgettablePayloadKey(client, {
          principalId,
          encryptedDek: generated.encryptedDek,
          mekVersion: generated.mekVersion,
        });
      }
    } else {
      const generated = await kms.generateDek();
      plaintextDek = generated.plaintextDek;
      await createForgettablePayloadKey(client, {
        principalId,
        encryptedDek: generated.encryptedDek,
        mekVersion: generated.mekVersion,
      });
    }

    const eventId = uuidv7();
    const userCreatedEvent: UserCreatedEvent = {
      id: eventId,
      tenantId,
      streamId: principalId,
      streamType: "User",
      streamPosition: 1,
      eventType: "UserCreated",
      correlationId,
      causationId: `command:${correlationId}`,
      actingPrincipalId: principalId,
      effectivePrincipalId: null,
      payload: {
        provider: identity.provider,
        providerSubjectId: identity.providerSubjectId,
        merged,
      },
      metadata: {},
      actualTime: new Date(),
    };

    const eventsToAppend = [
      ...(tenantCreatedEvent ? [tenantCreatedEvent] : []),
      ...(memberAddedEvent ? [memberAddedEvent] : []),
      userCreatedEvent,
    ];
    await appendEvents(client, eventsToAppend);
    await storeForgettablePayload(client, {
      eventId,
      tenantId,
      principalId,
      plaintext: {
        email: identity.email,
        name: identity.name,
        avatarUrl: identity.avatarUrl,
      },
      dek: plaintextDek,
    });

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
      action: "auth.login.success",
      detail,
    });

    writeAuditLog(db, {
      principalId,
      tenantId,
      action: "auth.invite.redeemed",
      resourceType: "invite",
      resourceId: invite.id,
      detail: { provider: identity.provider },
    });

    if (merged) {
      writeAuditLog(db, {
        principalId,
        tenantId,
        action: "auth.provider.linked",
        resourceType: "principal",
        resourceId: principalId,
        detail: { provider: identity.provider },
      });
    }

    return { ok: true, sessionToken, principalId, tenantId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Executes registration by first verifying the OIDC credential, then delegating
 * to executeRegistrationWithIdentity. Used by the single-step registration
 * endpoint (POST /api/auth/register).
 */
export async function executeRegistration(
  registry: OidcVerifierRegistry,
  db: Pool,
  emailHmacKey: string,
  kms: KeyManagementService,
  params: RegisterParams,
  log: Logger,
): Promise<RegisterResult> {
  const { provider, credential, inviteToken, tenantName, tenantSlug, userAgent } = params;
  const detail: { provider: string; user_agent: string } = {
    provider,
    user_agent: userAgent,
  };

  let identity: VerifiedIdentity;
  try {
    identity = await registry.verify(provider, credential);
  } catch (err) {
    if (err instanceof UnknownProviderError) {
      writeAuditLog(db, {
        principalId: SYSTEM_PRINCIPAL_ID,
        action: "auth.register.failure",
        detail: { ...detail, reason: "unknown_provider" },
      });
      return { ok: false, error: "unknown_provider", status: 400 };
    }
    if (err instanceof TokenVerificationError) {
      log.warn({ provider, err }, "Token verification failed");
      writeAuditLog(db, {
        principalId: SYSTEM_PRINCIPAL_ID,
        action: "auth.register.failure",
        detail: { ...detail, reason: "token_verification_failed" },
      });
      return { ok: false, error: "verification_failed", status: 401 };
    }
    throw err;
  }

  return executeRegistrationWithIdentity(
    db,
    emailHmacKey,
    kms,
    identity,
    {
      inviteToken,
      tenantName,
      tenantSlug,
      userAgent,
    },
    log,
  );
}

export function registerHandler(
  registry: OidcVerifierRegistry,
  db: Pool,
  emailHmacKey: string,
  kms: KeyManagementService,
): RequestHandler {
  return async (req, res) => {
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

      const result = await executeRegistration(
        registry,
        db,
        emailHmacKey,
        kms,
        {
          provider,
          credential,
          inviteToken,
          tenantName: typeof tenantName === "string" ? tenantName : undefined,
          tenantSlug: typeof tenantSlug === "string" ? tenantSlug : undefined,
          userAgent: req.requestContext.userAgent,
        },
        req.log,
      );

      if (!result.ok) {
        res.status(result.status).json({ error: result.error });
        return;
      }

      res.cookie(COOKIE_NAME, result.sessionToken, cookieOptions());
      res.json({ principal: { id: result.principalId }, tenant: { id: result.tenantId } });
    } catch (err) {
      req.log.error({ err }, "Unexpected error in register handler");
      res.status(500).json({ error: "internal_error" });
    }
  };
}
