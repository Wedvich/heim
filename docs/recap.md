# Session Recap

## Latest: Room Aggregate and Tabbed Settings UI

Two commits adding the Room aggregate with spot management and a full settings interface.

### What changed

**Domain — Room aggregate** (`packages/domain/src/room/`):

| File                   | Change                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `room-state.ts`        | `RoomState` with `roomId`, `name`, `spots` (Record of SpotState), `archived`, `createdAt`      |
| `room-commands.ts`     | Commands: `CreateRoom`, `RenameRoom`, `ArchiveRoom`, `AddSpot`, `RenameSpot`, `RemoveSpot`     |
| `room-events.ts`       | Events + `SPOT_KINDS` (`storage`, `fixture`, `appliance`) as const object with `SpotKind` type |
| `room-handler.ts`      | Command handler with validation (name length, spot uniqueness, archived guard)                 |
| `room-fold.ts`         | Pure reducer applying all room/spot events                                                     |
| `room-handler.test.ts` | Comprehensive handler tests                                                                    |
| `room-fold.test.ts`    | Fold/state transition tests                                                                    |

**Domain — Registry integration**: `aggregate-registry.ts` and `index.ts` updated to export Room types and register Room aggregate.

**API**: `index.ts` registers `roomHandler` in the command handler registry; `sync.test.ts` updated for Room stream type.

**Web — Settings UI** (`packages/web/src/pages/`):

| File                        | Change                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `SettingsPage.tsx`          | Rewritten: tabbed container with Account + Household tabs, URL param `?tab=` for tab state |
| `settings/AccountTab.tsx`   | Read-only user profile (avatar, name, email, role) + sign out button                       |
| `settings/HouseholdTab.tsx` | Tenant rename form (migrated) + room list with inline "Add room" form                      |
| `settings/RoomEditor.tsx`   | Expandable room row: inline rename, spot count, nested spot list                           |
| `settings/SpotEditor.tsx`   | Spot row: inline rename on blur, kind label, remove button                                 |
| `settings/AddSpotForm.tsx`  | Inline form: name input, kind select (storage/fixture/appliance), add button               |

**Web — Sync**: `room-model.ts` (MobX model with computed `name`, `spots`, `archived`, `spotList`), `command-registry.ts` (registered `roomHandler`), `sync-store.ts` (added `rooms` observable map), `execute-command.ts` (added Room case to `getModel`).

**Dependencies**: Added `uuid` to `@heim/web` for UUIDv7 ID generation (rooms and spots).

### Design decisions

- **Tabbed settings over nested routes**: The page is lightweight enough for a single `/settings` route with `?tab=` search param for tab state (survives refresh, allows direct linking).
- **Pre-register model for creation**: New rooms are created by adding a `RoomModel` with `INITIAL_ROOM_STATE` to `syncStore.rooms` before calling `executeCommand`, so `getModel()` finds it. On failure, the model is removed.
- **UUIDv7 for spot/room IDs**: Time-ordered IDs benefit B-tree indexing when spotId is later used as a location reference in inventory items and other aggregates.
- **Read-only Account tab**: No user update commands exist yet; the tab displays profile info and provides sign out. Ready for editing when domain commands are added.

### Git config fix

Found and removed a stray `[author] email = --get` section in `.git/config` that was overriding the correct `[user] email` for commit authorship.

### Test coverage

252 tests across 36 test files, all passing. Typecheck and lint clean.

### Next up

- Add internationalization (i18n) with Norwegian (Bokmål) and English, extensible for more languages
- Build inventory management UI (product type list, inventory item CRUD)
- Implement idempotency check on `POST /api/sync/commands`
- Implement conflict detection (aggregate version mismatch) on server

---

## Previous: Command Infrastructure, Inventory Vertical, and Optimistic Sync

Six commits delivering the full command handling pipeline, the household inventory bounded context, and end-to-end optimistic sync with speculative state management. 215 tests across 34 test files.

---

## Previous: Tenant Aggregate, Multi-Step Registration, and Cleanup

Nine commits covering the Tenant aggregate with membership events, multi-step registration with encrypted cookie, default tenant naming, aggregate registry consolidation, RLS fix, and dependency updates. 135 tests across 25 test files.

---

## Previous: Sync Bootstrap, Register Page, and SyncStore Wiring

Five commits covering the sync bootstrap endpoint, register UI, SyncStore integration, and a Postgres volume fix.

### What changed

- **Sync bootstrap:** `load-tenant-events.ts`, `GET /api/sync/bootstrap`, aggregate registry, `SyncStore` with observable maps, `fetchBootstrap` wrapper, React hook + `SyncBootstrap` component.
- **SyncStore wiring:** Replaced `UserProvider` with `SyncBootstrap` in `main.tsx`, HomePage reads from SyncStore. Removed `user-context.tsx` and `user/api.ts`.
- **Register page:** `RegisterPage.tsx` with Google Sign-In and invite token validation, `postRegister` wrapper, Google callback handler refactor, `create-invite.ts` CLI script.
- **Infra:** Fixed Postgres 18 volume mount path in `compose.yml`.
- **Decisions:** Added deferred decision on event stream consistency hardening.

124 tests across 24 test files.

---

## Previous: Postgres 18 / UUID v7, Sync Engine Design, and Session Skills

Three commits covering infrastructure upgrade, frontend sync architecture, and developer workflow.

### What changed

**Infrastructure** (`packages/infra/`):

| File          | Change                                                                                 |
| ------------- | -------------------------------------------------------------------------------------- |
| `compose.yml` | Upgraded from `postgres:17` to `postgres:18`                                           |
| `init.sql`    | All indexed IDs (`events.event_id`, `forgettable_payloads.payload_id`) now use UUID v7 |

UUID v7 gives time-ordered UUIDs — better index locality than v4 for append-heavy tables like the event store. The `register-handler` was updated to generate v7 IDs via the `uuid` package's v7 export.

**Sync architecture** (`docs/sync-architecture.md`, `packages/web/src/sync/`):

| File                   | Purpose                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- |
| `sync-architecture.md` | Full design doc: SyncStore, speculative state, command lifecycle, bootstrap flow |
| `model.ts`             | `Model` base class — MobX observable with `id`, `createdAt`, `updatedAt`         |
| `user-model.ts`        | `UserModel` — extends `Model` with `displayName`, `avatarUrl`, `updateFromEvent` |
| `model.test.ts`        | Tests for `Model` base class                                                     |
| `user-model.test.ts`   | Tests for `UserModel` event application                                          |

The MobX model layer is the foundation for the offline-first sync engine. Models are observable stores that update from authoritative events and will later also apply speculative commands.

**Developer workflow** (`.claude/skills/`):

| File              | Purpose                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `recap/SKILL.md`  | `/recap` skill — updated to derive session boundary from git history |
| `wrapup/SKILL.md` | `/wrapup` skill — session-end: updates docs, audits, commits         |

Session boundaries are now inferred from `git log -1 --format=%h -- docs/recap.md` — no more embedded HTML comment metadata.

### Test coverage

105 tests across 21 test files, all passing. Typecheck and lint clean.

### Next up

Co-write the remaining register-flow events (no PII encryption needed):

- `IdentityLinkedToUser` — emitted for every registration (links provider identity to principal)
- `TenantCreated` — emitted when a new tenant is created (create-tenant invite path)
- `MemberAddedToTenant` — emitted when a membership is created (both join and create paths)

After those, the next milestone is command infrastructure and the sync engine implementation.

---

## Previous: User Aggregate, Event Hydration, and Client-Side Fold

Three commits shipped together to close the loop from event append through to a hydrated UI state.

### What changed

**Domain types** (`packages/domain/src/`):

| File                | Purpose                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `aggregate.ts`      | `buildAggregate` — generic fold infrastructure; wraps an apply function and initial state |
| `user/aggregate.ts` | `buildUserAggregate` — creates a `UserAggregate` from a stream of events                  |
| `user/apply.ts`     | `applyUserEvent` — pure fold function: `(UserState, UserEvent) → UserState`               |
| `user/state.ts`     | `UserState` type — current in-memory representation of a user (display name, avatar URL)  |
| `user/index.ts`     | Barrel export for user aggregate                                                          |

**API** (`packages/api/src/`):

| File                                | Purpose                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `user/load-hydrated-user-stream.ts` | `loadHydratedUserStream` — loads events from DB, decrypts forgettable payloads |
| `routes/user.ts`                    | `GET /api/user/me/events` — streams hydrated events as JSON to the client      |

**Frontend** (`packages/web/src/`):

| File                    | Purpose                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `user/user-context.tsx` | `UserProvider` + `useUser()` — fetches event stream and folds it into `UserState` on mount |
| `pages/HomePage.tsx`    | Displays user's display name and avatar from folded `UserState`                            |

#### Modified files

| File                           | Change                                                 |
| ------------------------------ | ------------------------------------------------------ |
| `packages/domain/src/index.ts` | Re-exports aggregate infrastructure and user aggregate |
| `packages/web/src/main.tsx`    | Wraps app in `<UserProvider>`                          |

### Incremental sync design

`GET /api/user/me/events` accepts an optional `afterVersion` query parameter. The client tracks the last seen version in a `versionRef` and uses it on subsequent fetches to request only new events — enabling efficient incremental sync without re-loading the full stream.

### Serialization note

Event `actualTime` fields are serialized as ISO strings over the wire. The client parses them back to `Date` objects using a `reviver` function passed to `JSON.parse`, preserving the domain type contract.

### Test coverage

92 tests across 18 test files, all passing. Typecheck and lint clean.

### Next up

Co-write the remaining register-flow events (no PII encryption needed):

- `IdentityLinkedToUser` — emitted for every registration (links provider identity to principal)
- `TenantCreated` — emitted when a new tenant is created (create-tenant invite path)
- `MemberAddedToTenant` — emitted when a membership is created (both join and create paths)

After those, the next milestone is command infrastructure.

---

## Previous: Event Store — First Vertical (UserCreated)

Wired the event store write path end-to-end. When a user registers, a `UserCreated` event is now co-written in the same transaction alongside the existing CRUD writes, with PII encrypted in a forgettable payload.

### What changed

**Schema:** Renamed `crypto_keys` → `forgettable_payload_keys` in `init.sql`, `database.md`, `security.md`.

**Domain types** (`packages/domain/src/`):

| File                      | Purpose                                                 |
| ------------------------- | ------------------------------------------------------- |
| `events.ts`               | `DomainEvent`, `UserCreatedEvent`, `UserCreatedPayload` |
| `forgettable-payloads.ts` | `UserCreatedPii` (email, name, avatarUrl)               |
| `index.ts`                | Barrel export                                           |

**Crypto layer** (`packages/api/src/crypto/`):

| File                                    | Purpose                                                        |
| --------------------------------------- | -------------------------------------------------------------- |
| `kms.ts`                                | `KeyManagementService` interface + `LocalKeyManagementService` |
| `payload-encryption.ts`                 | `encryptPayload` / `decryptPayload` (AES-256-GCM)              |
| `forgettable-payload-key-repository.ts` | Per-principal DEK storage (idempotent upsert + lookup)         |

**Event store** (`packages/api/src/event-store/`):

| File                           | Purpose                                               |
| ------------------------------ | ----------------------------------------------------- |
| `append-events.ts`             | `appendEvents(client, events)` — parameterized INSERT |
| `store-forgettable-payload.ts` | Encrypt + store PII as forgettable payload            |

**Modified:**

| File                    | Change                                                                  |
| ----------------------- | ----------------------------------------------------------------------- |
| `register-handler.ts`   | Co-writes UserCreated event + forgettable payload in transaction        |
| `routes/auth.ts`        | Passes `kms` through to register handler                                |
| `index.ts`              | Reads `MASTER_ENCRYPTION_KEY`, instantiates `LocalKeyManagementService` |
| `CLAUDE.md`             | Added testing section: mock only DB/SQL and external APIs               |
| `docs/testing-guide.md` | Added `MASTER_ENCRYPTION_KEY` env var, event store verification queries |

### Register handler flow (updated steps 8–9)

After CRUD writes and invite mark-used, the handler now:

8. **Crypto key:** Generate DEK (new user) or decrypt existing DEK (email merge path)
9. **Co-write event:** Build `UserCreatedEvent` (no PII in payload) → `appendEvents` → `storeForgettablePayload` (encrypted email/name/avatarUrl)

### Environment variables

| Variable                | Required for                                                   |
| ----------------------- | -------------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`      | Login + Register                                               |
| `EMAIL_HMAC_KEY`        | Register only (any string; use 32+ random bytes in production) |
| `MASTER_ENCRYPTION_KEY` | Register only (base64-encoded 32 bytes)                        |

All three are required — the app throws on startup if any is missing.

### Next up

Co-write the remaining register-flow events (no PII encryption needed):

- `IdentityLinkedToUser` — emitted for every registration (links provider identity to principal)
- `TenantCreated` — emitted when a new tenant is created (create-tenant invite path)
- `MemberAddedToTenant` — emitted when a membership is created (both join and create paths)

### Test coverage

83 tests across 16 test files, all passing. Typecheck and lint clean.

---

## Previous: Routing, Google Sign-In, and Auth Hardening

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
