# Project Overview

**Heim** (Old Norse: _home_) is a personal/family planning tool with strong temporal capabilities. It tracks household inventory, chores, food items, study lists, and more — all built on event sourcing with bitemporal data to enable powerful analytics and time-travel queries.

- **Type:** Open-source, hosted on GitHub (public repo)
- **Author:** Martin (wedvich@gmail.com) + AI coding agents (Claude Code)
- **Development style:** Agent-driven TDD, intermittent hobby work
- **License:** Apache-2.0
- **Philosophy:** SOLID principles, Domain-Driven Design, CQRS/ES, offline-first

### Future Bounded Contexts (not yet prioritized)

These are ideas for future development. They are listed here for architectural awareness — the system should be designed so adding these later is straightforward.

- **Household Inventory** — track item packages with coarse quantities (empty → almost empty → opened → unopened), extensible to exact quantities. Track purchase dates for consumption analytics.
- **Food Inventory** — similar to household inventory but with recipe awareness ("we have A, B, C so we can make D").
- **Chore Tracking** — track chores (e.g., "clean toilet in bathroom 1"), who did them and when. Generate "it's been a while" nudges.
- **Study List** — track technologies/libraries with self-assessed proficiency. Spaced repetition reminders to revisit material.
- **Calendar Views** — unified calendar across all bounded contexts.
- **Notification / Scheduler System** — abstract notification production with per-user delivery preferences (push, email, SMS). Background job system for automated reminders. Exact implementation TBD — design for extensibility, don't over-build early.

## Phased Implementation Plan

### Phase 0: Repository Scaffolding

**Goal:** Repo exists, builds, and has CI — but does nothing yet.

- [ ] Initialize Yarn workspace monorepo with Turborepo
- [ ] Create package stubs: `@heim/domain`, `@heim/api`, `@heim/web`
- [ ] Configure TypeScript (strict, project references)
- [ ] Configure Vitest per package
- [ ] Configure oxlint + Lefthook (pre-commit: lint/format staged files, commit-msg: commitlint)
- [ ] Configure commitlint with @commitlint/config-conventional
- [ ] Set up @changesets/cli for monorepo release management
- [ ] Set up Docker Compose (Postgres + API + Web)
- [ ] Set up GitHub Actions CI (lint, typecheck, test)
- [ ] Create CLAUDE.md files at root and per package
- [ ] Create `docs/` structure with architecture.md and plan.md
- [ ] Create `.claude/` with recap and review agents
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

## 8. Claude Code Workflow

### CLAUDE.md Strategy

Each package has a `CLAUDE.md` that describes:

- What the package does and its boundaries
- Key patterns and conventions in use
- How to run tests
- What NOT to touch (e.g., "don't modify the base event types without discussing")

The root `CLAUDE.md` covers:

- Project overview and architecture summary
- How the packages relate
- How to run the full stack
- How to write session logs

### Session Logs

After each working session, write a summary to `docs/sessions/YYYY-MM-DD.md` covering:

- What was worked on
- What was completed
- What's in progress
- Any decisions made
- What to pick up next

### Recap Agent (`.claude/agents/recap.md`)

A prompt for Claude Code that reads recent session logs and git history to produce a "Previously on Heim..." summary. Martin can run this when returning to the project after a break.

### Review Agent (`.claude/agents/review.md`)

A prompt for Claude Code to review recent changes against the architecture doc, SOLID principles, and test coverage expectations.

---

## Key Conventions

- **Aggregate IDs** are UUIDs, generated by the command issuer (frontend or backend)
- **Events are immutable** — never modify an event after it's stored
- **All domain logic in `@heim/domain`** — api and web are infrastructure/UI shells
- **No direct DB access from domain logic** — repository interfaces in domain, implementations in api
- **Every aggregate method is a pure function**: `(currentState, command) → event[] | error`
- **Projections are pure folds**: `(currentProjection, event) → newProjection`
- **Tenant scoping is mandatory** — every command and query must include a tenant ID
- **ADRs for significant decisions** — anything that changes the architecture doc warrants an ADR
