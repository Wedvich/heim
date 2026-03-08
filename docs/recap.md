# Session Recap

## Latest: Routing, Google Sign-In, and Auth Hardening

### Web: Client-side routing and Google Sign-In

Added React Router v7 and a real Google Sign-In flow. The frontend now authenticates users through the existing backend endpoints instead of the manual textarea-based token pasting.

#### New files

| File                                           | Purpose                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/web/src/auth/api.ts`                 | Typed fetch wrappers: `fetchSession`, `postLogin`, `postLogout`                 |
| `packages/web/src/auth/auth-context.tsx`       | `AuthProvider` + `useAuth` — tracks `loading / authenticated / unauthenticated` |
| `packages/web/src/hooks/use-google-sign-in.ts` | Lazy-loads GIS script, initializes SDK, renders button via ref callback         |
| `packages/web/src/pages/LoginPage.tsx`         | Login page with Google button, redirects to `/` on success                      |
| `packages/web/src/pages/HomePage.tsx`          | Authenticated landing page with tenant info, settings link, sign-out            |
| `packages/web/src/pages/SettingsPage.tsx`      | Placeholder authenticated route                                                 |
| `packages/web/src/components/RequireAuth.tsx`  | Layout route guard — redirects unauthenticated users to `/login`                |
| `packages/web/src/env.d.ts`                    | `ImportMetaEnv` type for `GOOGLE_CLIENT_ID`                                     |

#### Modified files

| File                          | Change                                                                 |
| ----------------------------- | ---------------------------------------------------------------------- |
| `packages/web/package.json`   | Added `react-router` dependency                                        |
| `packages/web/vite.config.ts` | Function form with `loadEnv` to expose `GOOGLE_CLIENT_ID` via `define` |
| `packages/web/src/main.tsx`   | Wrapped `<App>` in `<BrowserRouter>` + `<AuthProvider>`                |
| `packages/web/src/App.tsx`    | Replaced manual testing UI with `<Routes>` / `<Route>` definitions     |

#### Auth flow

1. App mounts → `AuthProvider` calls `GET /api/auth/session`
2. Unauthenticated → `RequireAuth` redirects to `/login`
3. GIS script loaded lazily → renders branded Google button
4. User clicks → GIS returns ID token → `POST /api/auth/login` → session cookie set
5. `AuthProvider` updates state → redirect to `/`
6. Sign out → `POST /api/auth/logout` → redirect to `/login`

#### Environment

`GOOGLE_CLIENT_ID` is read from the root `.env` via Vite's `loadEnv` and exposed through `define` (not `VITE_` prefixed).

### API: Cache-Control on auth endpoints

Added `Cache-Control: no-store` middleware to the auth router. All auth endpoints (`/login`, `/register`, `/logout`, `/session`) now explicitly prevent browser and proxy caching.

---

## Previous: Registration Flow

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

### Environment variables

| Variable           | Required for                                                   |
| ------------------ | -------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID` | Login + Register                                               |
| `EMAIL_HMAC_KEY`   | Register only (any string; use 32+ random bytes in production) |

Both variables are required — the app throws on startup if either is missing.

### Test coverage

38 tests across 8 test files, all passing. Typecheck and lint clean.
