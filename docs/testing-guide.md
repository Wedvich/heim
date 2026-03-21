# Manual Testing Guide

Living guide for manually testing features against a local environment.

## Prerequisites

```bash
# Start Postgres + API (wipes DB for a fresh schema)
docker compose -f packages/infra/compose.yml down -v
yarn turbo dev -F @heim/api...
```

The API runs at `http://localhost:5244`.

### Environment variables

Set these before starting the API (or in a `.env` file if you use one):

| Variable                | Required for     | Example                                   |
| ----------------------- | ---------------- | ----------------------------------------- |
| `GOOGLE_CLIENT_ID`      | Login + Register | `123456.apps.googleusercontent.com`       |
| `EMAIL_HMAC_KEY`        | Register only    | Any secret string, e.g. `my-dev-hmac-key` |
| `MASTER_ENCRYPTION_KEY` | Register only    | Base64-encoded 32 bytes (see below)       |
| `REG_TOKEN_SECRET`      | Register only    | Base64-encoded 32 bytes (see below)       |

Generate dev secrets (`MASTER_ENCRYPTION_KEY` and `REG_TOKEN_SECRET`):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Getting a Google ID token

You need a real Google ID token for OIDC verification. The easiest way during development:

1. Open the [Google OAuth Playground](https://developers.google.com/oauthplayground/)
2. Or use the web app's Google Sign-In button and intercept the `credential` from the network tab
3. Or use `curl` with a service account (for CI)

The token is a JWT string (the `credential` field in the request body).

> **Tip**: If you haven't set up Google OIDC yet, consider adding a dev bypass verifier that skips token validation. See `docs/auth.md` for the planned `DEV_AUTH_BYPASS` mechanism.

---

## Scenarios

### 1. Registration — Create a new tenant

**Setup**: Insert an invite with no `tenant_id` (signals "create your own tenant"):

```sql
INSERT INTO invites (token, tenant_id, role, created_by, expires_at)
VALUES ('test-create-tenant', NULL, 'owner',
        '00000000-0000-0000-0000-000000000001', now() + interval '1 day');
```

**Request**:

```bash
curl -v -X POST http://localhost:5244/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "provider": "google",
    "credential": "<google-id-token>",
    "inviteToken": "test-create-tenant",
    "tenantName": "My Household"
  }'
```

Optionally pass `"tenantSlug": "my-household"` — if omitted, one is auto-generated from the name.

**Expect**:

- `200` with `{ "principal": { "id": "..." }, "tenant": { "id": "..." } }`
- `Set-Cookie: heim_sid=...` header
- DB rows created: `principals`, `identities`, `tenants`, `memberships`, `sessions`
- Invite row updated: `used_by` and `used_at` populated
- Event/forgettable_payloads partitions created for the new tenant
- `events` row with `event_type = 'UserCreated'`, `stream_type = 'User'`
- `forgettable_payloads` row with encrypted PII (email, name, avatarUrl)
- `forgettable_payload_keys` row with the principal's encrypted DEK

**Verify**:

```sql
-- Check the new principal and identity
SELECT p.id, p.type, i.provider, i.email_hash
FROM principals p JOIN identities i ON i.principal_id = p.id
ORDER BY p.created_at DESC LIMIT 1;

-- Check the tenant was created
SELECT * FROM tenants ORDER BY created_at DESC LIMIT 1;

-- Check the membership
SELECT * FROM memberships ORDER BY created_at DESC LIMIT 1;

-- Check the invite was consumed
SELECT id, token, used_by, used_at FROM invites WHERE token = 'test-create-tenant';

-- Check the UserCreated event
SELECT id, event_type, stream_type, stream_id, payload FROM events ORDER BY record_time DESC LIMIT 1;

-- Check the forgettable payload (should be non-cleartext bytea)
SELECT event_id, principal_id, octet_length(encrypted_payload) FROM forgettable_payloads LIMIT 1;

-- Check the crypto key
SELECT principal_id, mek_version FROM forgettable_payload_keys LIMIT 1;

-- Check audit log entries
SELECT action, resource_type, resource_id, detail FROM audit_log ORDER BY created_at DESC LIMIT 5;
```

---

### 2. Registration — Join an existing tenant

**Setup**: First create a tenant (via scenario 1, or manually):

```sql
INSERT INTO tenants (id, name, slug)
VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'Test Household', 'test-household');
```

Then create an invite for that tenant:

```sql
INSERT INTO invites (token, tenant_id, role, created_by, expires_at)
VALUES ('test-join-tenant', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'member',
        '00000000-0000-0000-0000-000000000001', now() + interval '1 day');
```

**Request**:

```bash
curl -v -X POST http://localhost:5244/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "provider": "google",
    "credential": "<google-id-token>",
    "inviteToken": "test-join-tenant"
  }'
```

No `tenantName` needed — the user is joining an existing tenant.

**Expect**:

- `200` with the existing tenant ID
- Membership created with role `member`

---

### 3. Registration — Email merge (identity linking)

This tests the case where a user already registered with one provider and now registers with another that has the same verified email.

**Setup**: Register once via scenario 1, then create a second invite:

```sql
INSERT INTO invites (token, tenant_id, role, created_by, expires_at)
VALUES ('test-merge', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'member',
        '00000000-0000-0000-0000-000000000001', now() + interval '1 day');
```

Register with a different provider (or different Google account) that has the **same email address**. If the email matches, the new identity links to the existing principal instead of creating a new one.

**Expect**:

- Same `principal.id` as the first registration
- A second row in `identities` for the same principal
- `auth.provider.linked` entry in `audit_log`

---

### 4. Registration — Error cases

**Invalid invite**:

```bash
curl -X POST http://localhost:5244/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"provider":"google","credential":"<token>","inviteToken":"nonexistent"}'
# Expect: 400 {"error":"invalid_invite"}
```

**Reusing a consumed invite**:

```bash
# Use the same invite token as a previous successful registration
# Expect: 400 {"error":"invalid_invite"}
```

**Already registered** (same provider+sub):

```bash
# Use a new invite but the same Google account
# Expect: 409 {"error":"already_registered"}
```

**Missing tenant name for create-tenant invite**:

```bash
curl -X POST http://localhost:5244/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"provider":"google","credential":"<token>","inviteToken":"<create-tenant-invite>"}'
# Expect: 400 {"error":"missing_tenant_name"}
```

---

### 5. Login (existing user)

After registering, login works with the same provider identity:

```bash
curl -v -X POST http://localhost:5244/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"provider":"google","credential":"<google-id-token>"}'
```

**Expect**: `200` with principal and tenant, `Set-Cookie` header.

---

### 6. Session check

```bash
curl -v http://localhost:5244/api/auth/session \
  -H 'Cookie: heim_sid=<session-token>'
```

**Expect**: `200` with principal, tenant, membership, and expiry.

---

### 7. Slug availability

Check if a tenant slug is available. Requires either a session cookie or an invite token:

```bash
# With session cookie
curl 'http://localhost:5244/api/tenants/slug-available?slug=my-team' \
  -H 'Cookie: heim_sid=<session-token>'

# With invite token
curl 'http://localhost:5244/api/tenants/slug-available?slug=my-team' \
  -H 'Authorization: Bearer test-create-tenant'
```

**Expect**: `{ "available": true, "valid": true }` or `{ "available": false, "valid": true }`.

Invalid slugs return `{ "available": false, "valid": false, "reason": "..." }` with reasons like `too_short`, `too_long`, `invalid_characters`, or `reserved`.

---

### 8. Logout

```bash
curl -v -X POST http://localhost:5244/api/auth/logout \
  -H 'Cookie: heim_sid=<session-token>'
```

**Expect**: `200 { "ok": true }`, cookie cleared, session row deleted.

---

## Quick DB reset

```bash
docker compose -f packages/infra/compose.yml down -v
yarn turbo dev -F @heim/api...
```

This drops the volume and re-runs `init.sql` on startup.
