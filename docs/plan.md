## Phased Implementation Plan

### Phase 1: Event Store Foundation

**Goal:** A working custom event store with bitemporal support.

- [ ] Define base event types with bitemporal metadata (record time + actual time)
- [ ] Define base aggregate class with apply/fold pattern
- [ ] Define command types and command handler interface
- [ ] Define repository interface
- [ ] Implement Postgres event store (append, load stream, load at point in time)
- [ ] Implement Postgres migrations for event store tables
- [ ] Write comprehensive tests: append, reload, ordering, bitemporal queries
- [ ] Implement basic projection infrastructure (subscribe to stream, fold into read model)
- [ ] Add `compose.prod.yml` with nginx as production entry point (serve static bundle, proxy `/api` to Express)

> **Dev vs. prod serving:** In local development, Vite's built-in `server.proxy` forwards `/api` requests to Express — no nginx needed. In production, nginx serves the static Vite bundle directly and reverse-proxies `/api` to the Express container. The production topology is defined in a separate `compose.prod.yml`.

### Phase 2: Auth & Multi-Tenancy

**Goal:** Users can log in with Google/Apple, create/join tenants, and get JWT tokens.

- [ ] Implement User, Identity, Tenant, Membership aggregates in `@heim/domain`
- [ ] Implement commands: register, link identity, create tenant, add member, etc.
- [ ] Implement ABAC policy engine with role-based initial policies
- [ ] Implement OIDC integration (Google + Apple) in `@heim/api`
- [ ] Implement JWT token issuance and refresh via `jose`
- [ ] Implement dev bypass auth
- [ ] Implement auth middleware (token validation, tenant context extraction)
- [ ] Implement impersonation middleware
- [ ] Build basic login UI in `@heim/web` (provider selection, tenant selection)
- [ ] Build projections: user profile, tenant member list
- [ ] E2E test: full login flow with dev bypass

### Phase 3: Offline-First Sync Engine

**Goal:** Frontend can work offline, queue commands, and reconcile with backend.

- [ ] Implement command queue in frontend (IndexedDB or in-memory)
- [ ] Implement speculative state manager (apply commands locally via shared domain logic)
- [ ] Implement sync protocol (send queued commands, receive confirmed events)
- [ ] Implement conflict detection (aggregate version mismatch)
- [ ] Implement rollback and replay on conflict
- [ ] Handle reconnection (sync queued commands on coming back online)
- [ ] Test: offline command → reconnect → confirm/reject cycle

### Phase 4: First Feature Bounded Context

**Goal:** Implement the first actual user-facing feature (TBD — likely Household Inventory or Chore Tracking).

_To be planned when Phase 3 is complete. The event store, auth, and sync engine should be solid by then._
