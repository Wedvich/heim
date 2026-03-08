# Session Recap — Registration Flow

## What was implemented

Invite-only registration via `POST /api/auth/register`, with HMAC email hashing for cross-provider identity merge.

### New files

| File                                         | Purpose                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `packages/api/src/auth/email-hash.ts`        | HMAC-SHA256 email hashing (normalize + hash)                                                      |
| `packages/api/src/auth/invite-repository.ts` | `findValidInvite` (with `FOR UPDATE` row lock), `markInviteUsed`                                  |
| `packages/api/src/auth/slug.ts`              | `generateSlug`, `generateSlugWithSuffix`, `validateSlug` + reserved slug list                     |
| `packages/api/src/auth/register-handler.ts`  | Full registration handler (invite validation, OIDC verify, email merge, tenant creation, session) |
| `packages/api/src/middleware/light-auth.ts`  | Middleware accepting session cookie OR invite bearer token                                        |
| `packages/api/src/routes/tenants.ts`         | `GET /api/tenants/slug-available` endpoint                                                        |
| `docs/testing-guide.md`                      | Manual testing guide for all auth scenarios                                                       |

### Modified files

| File                                           | Change                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `packages/infra/init.sql`                      | Added `invites` table + indexes                                  |
| `packages/api/src/auth/identity-repository.ts` | Added `findPrincipalByEmailHash`, `createIdentity`               |
| `packages/api/src/audit/audit-logger.ts`       | Typed `AuditAction` union replacing `action: string`             |
| `packages/api/src/routes/auth.ts`              | Accepts optional `emailHmacKey`, mounts `/register` when present |
| `packages/api/src/index.ts`                    | Reads `EMAIL_HMAC_KEY` env var, mounts tenants router            |

### Registration flow summary

1. Validate input (`provider`, `credential`, `inviteToken`)
2. Look up invite (row-locked to prevent races)
3. Verify OIDC credential
4. Reject if identity already registered (409)
5. Email merge: if email is verified, HMAC-hash it and check for existing principal with same hash — reuse if found
6. Create principal + identity
7. Tenant: join existing (if invite has `tenant_id`) or create new (requires `tenantName`, auto-generates slug with fallback to suffixed variant)
8. Mark invite used, create session, set cookie — all in one transaction
9. Fire-and-forget audit logs: `auth.register.success`, `auth.invite.redeemed`, optionally `auth.provider.linked`

### Audit actions added

`auth.register.success`, `auth.register.failure`, `auth.invite.redeemed`, `auth.provider.linked`

### Slug generation behavior

`generateSlug("My Household")` produces `my-household`. The register handler tries this first; only if taken, it falls back to `generateSlugWithSuffix` which appends a 4-char hex suffix (e.g. `my-household-a3f1`). Explicit `tenantSlug` from the client is validated and used as-is (409 if taken).

### Environment variables

| Variable           | Required for                                                   |
| ------------------ | -------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID` | Login + Register                                               |
| `EMAIL_HMAC_KEY`   | Register only (any string; use 32+ random bytes in production) |

If `EMAIL_HMAC_KEY` is not set, the app boots normally but `/auth/register` is not mounted.

### Test coverage

38 tests across 8 test files, all passing. Typecheck and lint clean.
