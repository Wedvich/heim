# Security

Analysis of Heim against the [OWASP Top 10:2025](https://owasp.org/Top10/2025/). Each category covers
current posture, gaps, and suggested integration tests. Tests assume Vitest + real Postgres (via Docker
Compose) + supertest for HTTP assertions.

---

## A01:2025 — Broken Access Control

### Current posture

- RLS on `events`, `forgettable_payloads`, `memberships`, `audit_log` via `SET LOCAL app.current_tenant_id`
- `validateReturnTo()` blocks open redirects (only relative paths starting with `/`)
- CSRF double-submit check on Google callback
- Session cookie: `httpOnly`, `secure` (prod), `sameSite: lax`
- CORS handled by Express middleware (`cors` package) reading allowed origins from the `CORS_ORIGIN`
  env var. nginx does not need to duplicate CORS headers.
- Session fixation is N/A — no pre-authentication session exists. The session token is created fresh
  on login via `crypto.randomBytes(32)`, so there is nothing to fixate.

### Gaps

1. **No authorization middleware on API routes.** The ABAC policy engine is designed
   ([docs/auth.md](auth.md)) but not wired in — any authenticated principal can hit any endpoint.
2. **RLS depends on app-layer discipline.** If any query runs without `SET LOCAL app.current_tenant_id`,
   RLS silently allows nothing (empty result) or everything (if using BYPASSRLS role).

### Suggested integration tests

```
tests/access-control/
├── rls-tenant-isolation.test.ts
│   - Create two tenants (A and B) with events in each
│   - SET LOCAL to tenant A, query events → only A's events returned
│   - SET LOCAL to tenant B, query events → only B's events returned
│   - Omit SET LOCAL, query events → 0 rows (verify RLS default-deny)
│   - Same pattern for memberships, forgettable_payloads, audit_log
│
└── cross-tenant-api.test.ts
    - Authenticate as user in tenant A
    - Attempt to access tenant B resources via API → 403/404
    - Attempt to switch session to tenant B without membership → rejected
```

---

## A02:2025 — Security Misconfiguration

### Current posture

- `Cache-Control: no-store` on auth routes
- `express.json()` with default 100KB limit
- Docker Compose uses hardcoded `POSTGRES_PASSWORD: "heim"` (dev only)
- Helmet middleware applied as the first middleware in Express, covering `X-Frame-Options`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Content-Security-Policy`. HSTS is
  deferred to the nginx/TLS termination layer.
- Global error handler returns generic JSON 500 — no stack trace or internals leaked to clients.
- PgAdmin exposed on port 5050 in dev compose — not deployed to production.

### Gaps

None — all previously identified gaps have been resolved.

### Suggested integration tests

```
tests/security-headers/
├── response-headers.test.ts
│   - GET /api/health → verify X-Content-Type-Options: nosniff
│   - GET /api/health → verify X-Frame-Options: DENY (or CSP frame-ancestors)
│   - GET /api/auth/session → verify Cache-Control: no-store
│   - All responses → verify Content-Type includes charset
│
├── error-response-format.test.ts
│   - POST /api/auth/login with malformed JSON → 400, no stack trace in response
│   - GET /api/nonexistent → 404, generic message (not Express default HTML)
│   - Trigger 500 (e.g., DB down) → response contains no internal details
│
└── body-size-limit.test.ts
    - POST /api/auth/login with >100KB body → 413 Payload Too Large
```

---

## A03:2025 — Software Supply Chain Failures

### Current posture

- Minimal dependency footprint: `express`, `pg`, `google-auth-library` (API); `react`, `react-dom`,
  `react-router` (web)
- `yarn.lock` committed (Yarn 4.13.0)
- Dependabot not yet configured (`.github/dependabot.yml` does not exist — TODO).

### Gaps

1. **No SBOM generation.**
2. **No integrity checks** beyond yarn.lock checksums.

### Suggested CI checks

```
ci/
├── yarn-audit.yml          — Run `yarn npm audit` on every PR
├── lockfile-integrity.yml  — Verify yarn.lock is in sync with package.json
└── dependency-review.yml   — Flag new dependencies added in PRs
```

One runtime test is relevant:

```
tests/supply-chain/
└── no-eval-or-dynamic-require.test.ts
    - Static analysis: grep source for eval(), Function(), new Function, import()
      with dynamic strings → fail if found
```

---

## A04:2025 — Cryptographic Failures

### Current posture

- Session tokens: 32-byte `crypto.randomBytes`, base64url
- Email correlation: HMAC-SHA256 with dedicated `EMAIL_HMAC_KEY`
- 2-tier MEK→DEK envelope encryption for forgettable payloads (AES-256-GCM via `encryptPayload`/`decryptPayload`)
- `LocalKeyManagementService`: generates per-principal DEKs, encrypts them with MEK, supports MEK versioning
- Registration cookie (`heim_reg`): AES-256-GCM encrypted with dedicated `REG_TOKEN_SECRET`, httpOnly, 15-min TTL. Carries verified Google identity claims between auth callback and registration completion. PII (email, name, avatar) never appears in cleartext outside the server's encryption envelope.
- `secure` cookie flag in production
- Three independent server secrets: `MASTER_ENCRYPTION_KEY`, `EMAIL_HMAC_KEY`, `REG_TOKEN_SECRET` (see [docs/database.md](database.md) for details)

### Gaps

1. **Email HMAC is unsalted.** Documented and accepted tradeoff, but compromised key enables rainbow
   table attack.
2. **No TLS enforcement visible.** Assumed via nginx, but no HSTS header.

### Suggested integration tests

```
tests/crypto/
├── session-token-entropy.test.ts
│   - Create 1000 sessions → all tokens are unique
│   - Token length is consistent (43-44 chars base64url for 32 bytes)
│   - Tokens contain only base64url characters [A-Za-z0-9_-]
│
├── email-hash-correctness.test.ts
│   - Hash("user@example.com") with known key → deterministic output
│   - Hash("USER@Example.Com") === hash("user@example.com") (normalization)
│   - Hash with different key → different output (key dependence)
│   - Hash output is 64-char hex string
│
├── forgettable-payload-encryption.test.ts  (once MEK is implemented)
│   - Write forgettable payload → encrypted_payload is not plaintext
│   - Read back → decrypted content matches original
│   - Delete crypto_key for principal → payload unreadable (crypto shredding)
│   - Rotate MEK → old payloads still readable with re-encrypted DEK
│
└── cookie-security.test.ts
    - Login in NODE_ENV=production → cookie has Secure flag
    - Login → cookie has HttpOnly flag
    - Login → cookie has SameSite=Lax
    - Cookie value is opaque (not a JWT, not decodable)
```

---

## A05:2025 — Injection

### Current posture

- **All DB queries use parameterized `$1, $2` placeholders** — no string concatenation in SQL.
- One exception: partition DDL in `register-handler.ts` interpolates `tenantId` into table name. However,
  `tenantId` comes from `gen_random_uuid()` (UUID format guaranteed by Postgres).

### Gaps

1. **Partition DDL uses string interpolation.** Safe only because input is a Postgres-generated UUID. If
   tenant creation ever accepts user-supplied IDs, this becomes SQL injection.
2. **No input validation library.** Manual type checks (`typeof x !== "string"`) are used. No schema
   validation (zod/joi).

### Suggested integration tests

```
tests/injection/
├── sql-injection-auth.test.ts
│   - POST /api/auth/login with credential containing SQL fragments
│     (e.g., "'; DROP TABLE sessions; --") → no DB error, proper error response
│   - GET /api/tenants/slug-available?slug='; DROP TABLE tenants;-- → parameterized, no effect
│
├── partition-ddl-safety.test.ts
│   - Verify tenant IDs in DB match UUID v4 format
│   - (If tenant creation ever accepts external IDs) test with malicious input
│
└── xss-in-api-responses.test.ts
    - Create tenant with name containing <script>alert(1)</script>
    - GET /api/auth/session → response Content-Type is application/json (not text/html)
    - Response body contains the script tag as a JSON string value, not executable HTML
```

---

## A06:2025 — Insecure Design

### Current posture

- CQRS + Event Sourcing: good audit trail by design
- Immutable events: facts can't be tampered with
- Separate read/write models
- Tenant isolation at multiple levels (RLS, partitioning, application)

### Gaps

1. **No rate limiting** on any endpoint. Auth endpoints are especially sensitive.
2. **30-day session TTL** is long for a passwordless system. A leaked cookie remains valid for a month.
3. **No account lockout** after failed login attempts.
4. **Email auto-merge trusts OIDC provider's `email_verified` claim.** If a rogue provider is ever added,
   this is an account takeover vector. Currently only Google is supported (trusted).
5. **System principal command rejection not enforced.** `docs/database.md` states the system principal must
   not be usable via user-facing paths, but this guard isn't implemented.

### Suggested integration tests

```
tests/design/
├── rate-limiting.test.ts  (once implemented)
│   - POST /api/auth/login 100 times rapidly → 429 after threshold
│   - POST /api/auth/register 100 times rapidly → 429 after threshold
│   - Verify rate limit is per-IP, not global
│
├── session-lifecycle.test.ts
│   - Create session → expires_at is ≤ configured TTL from now
│   - Use expired session → 401, cookie cleared
│   - Logout → session deleted from DB
│   - Logout → session removed from in-memory cache
│   - Use logged-out session within cache TTL → still rejected (cache invalidated)
│
├── email-merge-safety.test.ts
│   - Register user A with google (email: a@x.com)
│   - Register user B with different provider, same email hash → linked to same principal
│   - Register user C with unverified email → NOT merged, new principal created
│
└── system-principal-guard.test.ts  (once command handlers exist)
    - Submit command with acting_principal_id = system principal UUID → rejected
    - Verify system principal cannot be used to create sessions
```

---

## A07:2025 — Authentication Failures

### Current posture

- Delegates authentication to Google OIDC (strong)
- Token verification via `google-auth-library` (maintained by Google)
- Opaque session tokens (not JWTs — no client-side tampering)
- Audit logging of login success/failure

### Gaps

1. **No rate limiting on auth endpoints** (repeated — most critical gap).
2. **No session invalidation across devices.** Logout only kills current session.
3. **No MFA support.** Single-factor (OIDC) only.
4. **Account enumeration possible.** `/login?error=not_registered` vs `/login?error=csrf_failed` reveals
   whether an identity exists. The callback differentiates `unknown_identity` from `no_membership`.

### Suggested integration tests

```
tests/auth/
├── login-flow.test.ts
│   - Valid OIDC token for registered user → session cookie set, redirect to returnTo
│   - Valid token for unregistered user → redirect to /login?error=not_registered
│   - Invalid/expired OIDC token → redirect to /login?error=invalid_credential
│   - Missing credential field → redirect to /login?error=invalid_credential
│
├── session-invalidation.test.ts
│   - Login → use session → logout → use same session → 401
│   - Login on "device A" → login on "device B" → logout on A → B still works
│   - (future) "logout everywhere" → both A and B invalidated
│
├── audit-trail.test.ts
│   - Successful login → audit_log entry with action "auth.login.success"
│   - Failed login (bad token) → audit_log entry with action "auth.login.failure"
│   - Logout → audit_log entry with action "auth.logout"
│   - Audit entries contain user_agent but NOT email/PII
│
└── token-replay.test.ts
    - Use same OIDC credential token twice → second attempt should still work
      (Google tokens are valid for a window, this is expected)
    - Use session token after expiry → rejected
```

---

## A08:2025 — Software or Data Integrity Failures

### Current posture

- Events are append-only and immutable
- Optimistic concurrency via `(stream_id, stream_position)` uniqueness
- yarn.lock committed

### Gaps

1. **No CI/CD pipeline visible.** No signed artifacts, no deployment verification.
2. **No subresource integrity (SRI)** on frontend assets (Vite handles hashing, but CDN integrity
   unverified).
3. **Co-write invariant (CRUD + event in same transaction) is not verified by tests.**

### Suggested integration tests

```
tests/integrity/
├── event-immutability.test.ts
│   - Insert event → attempt UPDATE → fails (or verify no update path exists)
│   - Insert event → verify record_time is system-set, not overridable
│
├── optimistic-concurrency.test.ts
│   - Two concurrent writes to same stream at same position → one succeeds, one gets unique violation
│   - Sequential writes with incrementing positions → both succeed
│
└── co-write-invariant.test.ts
    - Register tenant → verify both tenants row AND TenantCreated event exist
    - Register user → verify both principals row AND corresponding event exist
    - Simulate transaction failure mid-write → neither CRUD nor event persisted (atomicity)
```

---

## A09:2025 — Security Logging and Alerting Failures

### Current posture

- `audit_log` table captures auth events (login success/failure, logout)
- PII guardrails: typed `AuditDetail` interface restricts fields
- `events.metadata` has PII guardrail + size `CHECK` constraint
- Structured logging via pino + pino-http (request logging with request IDs)

### Gaps

1. **No alerting or monitoring.** Audit log is written but never read programmatically.
2. **No IP address logging** (deferred until scrubbing mechanism exists — documented).
3. **Correlation ID not yet threaded through to audit entries.** `correlation_id` field exists in the
   `AuditDetail` type and `correlationId` is available in request context, but callers don't pass it
   through yet.
4. **Failed login patterns not detected.** 100 failed logins from one IP produce 100 audit rows but no
   alert.

### Suggested integration tests

```
tests/logging/
├── audit-completeness.test.ts
│   - Every auth action (login success, login failure, logout, register) → audit entry exists
│   - Audit entries have: principal_id, action, detail with user_agent
│   - Audit detail does NOT contain email, name, or other PII
│
├── audit-no-pii.test.ts
│   - Register user with known email → grep audit_log detail for email string → not found
│   - Check events.metadata for PII patterns → not found
│
└── error-responses-no-leaks.test.ts
    - Trigger various errors → response bodies don't contain stack traces
    - Trigger DB errors → response bodies don't contain SQL or table names
```

---

## A10:2025 — Mishandling of Exceptional Conditions

### Current posture

- Google callback handler has try/catch with redirect to `/login?error=internal`
- Session middleware silently continues if no cookie (graceful degradation)
- DB pool handles connection errors
- Global error handler catches unhandled route errors and returns generic JSON 500

### Gaps

1. **No graceful handling of DB pool exhaustion.** If all connections are in use, requests hang until
   timeout.
2. **No `statement_timeout` on DB queries.** A slow query blocks a connection indefinitely.
3. **Shutdown handler doesn't set a timeout.** `server.close()` waits forever for in-flight requests.
4. **Session cache grows unbounded.** No max-size eviction — a memory leak vector under high session
   churn.

### Suggested integration tests

```
tests/error-handling/
├── global-error-handler.test.ts
│   - Trigger uncaught error in route → 500 with generic JSON error, no stack trace
│   - Verify Content-Type: application/json on error responses
│
├── db-unavailable.test.ts
│   - Stop Postgres → hit /api/auth/session → 500 (not hang), meaningful error code
│   - Restart Postgres → service recovers automatically
│
├── malformed-input.test.ts
│   - POST /api/auth/login with body: null → 400
│   - POST /api/auth/register with body: {credential: 123} (wrong type) → 400
│   - POST with Content-Type: text/plain → 400 or 415
│   - GET /api/tenants/slug-available?slug= (empty) → 400
│
└── concurrent-operations.test.ts
    - Two simultaneous registrations with same OIDC identity → one succeeds, one gets conflict
    - Two simultaneous session lookups for same token → both succeed (cache safe)
```

---

## Priority Matrix

| Priority | Test suite                         | OWASP category | Rationale                                |
| -------- | ---------------------------------- | -------------- | ---------------------------------------- |
| **P0**   | RLS tenant isolation               | A01            | Data leak across tenants is catastrophic |
| **P0**   | SQL injection on all endpoints     | A05            | Foundational safety verification         |
| **P0**   | Audit log completeness + no PII    | A09            | GDPR compliance, non-repudiation         |
| **P1**   | Auth flow (login/logout/session)   | A07            | Core security mechanism                  |
| **P1**   | Co-write invariant (CRUD + events) | A08            | Data integrity foundation                |
| **P1**   | Cookie security flags              | A04            | Session hijacking prevention             |
| **P1**   | Error response leakage             | A10, A02       | Information disclosure                   |
| **P2**   | Optimistic concurrency             | A08            | Race condition safety                    |
| **P2**   | Rate limiting (once implemented)   | A06, A07       | Abuse prevention                         |
| **P3**   | Session token entropy              | A04            | Already using `crypto.randomBytes`       |
| **P3**   | Body size limits                   | A02            | Express default is reasonable            |
| **P3**   | Supply chain CI checks             | A03            | CI concern, not runtime                  |

---

## Implementation Changes Required

These gaps require code changes before they can be tested:

1. **Rate limiting** — no middleware exists; add before auth endpoints at minimum.
2. **Forgettable payload encryption** — schema ready, code missing.
3. **ABAC enforcement middleware** — policy engine designed, not wired into routes.

---

## Summary

**Biggest cross-cutting gaps:**

- No rate limiting on any endpoint — the most repeated finding across A01, A06, A07
- Forgettable payload encryption not implemented — schema ready, zero code

**Strongest areas:**

- Parameterized queries everywhere (A05 injection is well-covered)
- Minimal dependency surface (A03 supply chain risk is low)
- Thoughtful RLS + partitioning design (A01) — needs integration tests to prove it works
- Good audit logging foundation (A09) — but no alerting layer

**P0 tests to implement first:** RLS tenant isolation, auth flow correctness, and audit log
completeness/no-PII verification.
