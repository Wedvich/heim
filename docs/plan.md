## Phased Implementation Plan

### Phase 1: Event Store Foundation

**Goal:** A working custom event store with bitemporal support.

- [x] Define base event types with bitemporal metadata (record time + actual time)
- [x] Implement Postgres event store tables (events, forgettable_payloads, forgettable_payload_keys)
- [x] Implement event append (`appendEvents`) and forgettable payload storage
- [x] Implement KMS abstraction + payload encryption (AES-256-GCM, MEK → DEK)
- [x] Co-write first event: `UserCreated` with encrypted forgettable payload (PII)
- [ ] Co-write remaining register-flow events (no PII encryption):
  - [ ] `IdentityLinkedToUser` — every registration (links provider identity to principal)
  - [ ] `TenantCreated` — create-tenant invite path
  - [ ] `MemberAddedToTenant` — both join and create paths
- [x] Define base aggregate class with apply/fold pattern
- [ ] Define command types and command handler interface
- [ ] Define repository interface
- [ ] Implement stream loading (load stream, load at point in time)
- [ ] Write comprehensive tests: reload, ordering, bitemporal queries
- [ ] Implement basic projection infrastructure (subscribe to stream, fold into read model)
- [ ] Add `compose.prod.yml` with nginx as production entry point (serve static bundle, proxy `/api` to Express)

> **Dev vs. prod serving:** In local development, Vite's built-in `server.proxy` forwards `/api` requests to Express — no nginx needed. In production, nginx serves the static Vite bundle directly and reverse-proxies `/api` to the Express container. The production topology is defined in a separate `compose.prod.yml`.

### Phase 2: Auth & Multi-Tenancy

**Goal:** Users can log in with Google/Apple, create/join tenants, and get JWT tokens.

- [x] Implement OIDC integration (Google) in `@heim/api`
- [x] Implement invite-only registration with email merge
- [x] Implement session-based auth (cookie, middleware)
- [x] Implement login flow
- [x] Build basic login UI in `@heim/web` (Google Sign-In, routing, auth context)
- [x] Implement User aggregate in `@heim/domain`
- [x] Serve hydrated user event stream (`GET /api/user/me/events`) and fold on client
- [ ] Implement Identity, Tenant, Membership aggregates in `@heim/domain`
- [ ] Implement commands: register, link identity, create tenant, add member, etc.
- [ ] Implement ABAC policy engine with role-based initial policies
- [ ] Implement Apple OIDC provider
- [ ] Implement Microsoft OIDC provider
- [ ] Implement JWT token issuance and refresh via `jose`
- [ ] Implement dev bypass auth
- [ ] Implement impersonation middleware
- [ ] Build projections: user profile, tenant member list
- [ ] E2E test: full login flow with dev bypass

### Phase 3: Offline-First Sync Engine

**Goal:** Frontend can work offline, queue commands, and reconcile with backend.

- [x] Design sync architecture ([docs/sync-architecture.md](sync-architecture.md))
- [x] Implement MobX model layer foundation (`Model` base class, `UserModel` subclass)
- [ ] Implement command type, handler interface, and handler registry in `@heim/domain`
- [ ] Implement first command handler (e.g. `UserCommandHandler`)
- [ ] Implement `POST /api/sync/commands` (registry dispatch, idempotency, event append)
- [ ] Implement `GET /api/sync/bootstrap` (fold all tenant aggregates, return snapshots + cursor)
- [ ] Implement `SyncStore` with observable maps, pending commands, speculative events
- [ ] Implement speculative state manager (apply commands locally via shared domain logic)
- [ ] Implement confirmation and rollback (match by `commandId`, replace speculative with authoritative)
- [ ] Wire up: replace `UserProvider` with `SyncStore` + `observer` components
- [ ] Implement conflict detection (aggregate version mismatch)
- [ ] Handle reconnection (sync queued commands on coming back online)
- [ ] Test: offline command → reconnect → confirm/reject cycle
- [ ] Delta sync endpoint (when needed)
- [ ] IndexedDB persistence (when offline support is prioritized)
- [ ] SSE/WS push channel (when real-time multi-device sync is needed)

### Phase 4: First Feature Bounded Context

**Goal:** Implement the first actual user-facing feature (TBD — likely Household Inventory or Chore Tracking).

_To be planned when Phase 3 is complete. The event store, auth, and sync engine should be solid by then._
