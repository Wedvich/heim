## Phased Implementation Plan

### Phase 0: Repository Scaffolding

**Goal:** Repo exists, builds, and has CI — but does nothing yet.

- [x] Initialize Yarn workspace monorepo with Turborepo
- [x] Create package stubs: `@heim/domain`, `@heim/api`, `@heim/web`
- [x] Configure TypeScript (strict, project references)
- [x] Configure Vitest per package
- [x] Configure oxlint + Lefthook (pre-commit: lint/format staged files, commit-msg: commitlint)
- [x] Configure commitlint with @commitlint/config-conventional
- [ ] Set up @changesets/cli for monorepo release management
- [ ] Set up Docker Compose (Postgres + API + Web)
- [x] Set up GitHub Actions CI (lint, typecheck, test)
- [~] Create CLAUDE.md files at root and per package _(root done; per-package CLAUDE.md files missing)_
- [x] Create `docs/` structure with architecture.md and plan.md
- [~] Create `.claude/` with recap and review agents _(directory exists; recap and review agents missing)_
- [ ] Verify: `yarn install && yarn build && yarn test && docker compose up` all work

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
