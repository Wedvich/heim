# Heim — Decision Log

Summary of all architectural and technical decisions made during the initial planning session (February 2026).

---

## Project Identity

|               |                                           |
| ------------- | ----------------------------------------- |
| **Name**      | Heim (Old Norse: _home_)                  |
| **Type**      | Open-source personal/family planning tool |
| **Repo**      | Public GitHub repository                  |
| **License**   | Apache-2.0                                |
| **npm scope** | `@heim/*`                                 |

---

## Core Architectural Decisions

### 1. Event Sourcing (custom implementation)

**Decision:** Build the event store from scratch as a learning exercise rather than using an existing library (EventStoreDB, Marten, etc.).
**Rationale:** Primary goal is learning ES patterns deeply. Custom implementation gives full control over bitemporal support and the sync engine.

### 2. CQRS (Command Query Responsibility Segregation)

**Decision:** Full CQRS separation — commands on the write side produce events; projections on the read side build view-specific read models.
**Rationale:** Natural fit with event sourcing. Enables different read models per view (calendar, dashboard, shopping list) from the same event stream.

### 3. Bitemporal Data Model

**Decision:** Every event carries record time (when stored) and actual time (when it happened in the real world).
**Rationale:** Enables time-travel queries, accurate historical reconstruction, and audit capabilities. Reference: [Fowler — Bitemporal History](https://martinfowler.com/articles/bitemporal-history.html).

### 4. Offline-First with Speculative Command Application

**Decision:** Frontend creates commands (not events), speculatively applies them via shared domain logic for instant UI updates, then sends commands to backend for authoritative event production.
**Rationale:** Preserves event sourcing semantics (events = facts, only backend is authoritative) while achieving Linear-style optimistic UI. Shared domain logic means no duplicate code for optimistic updates.
**Conflict model:** Per-aggregate version checking. Conflicts only occur when the same aggregate was modified. Unrelated aggregate changes don't conflict.

### 5. Shared Domain Package

**Decision:** `@heim/domain` contains all domain logic (aggregates, commands, events, value objects, validation, ABAC policies) and runs on both frontend and backend.
**Rationale:** Enables offline-first speculative updates. Single source of truth for business rules. Frontend and backend always agree on validation and authorization.
**Excludes:** Infrastructure concerns (DB access, HTTP, file I/O) — those live in `@heim/api` and `@heim/web`.

### 6. Multi-Tenancy via Tenant ID Column

**Decision:** All data is scoped by a tenant ID column, not schema-per-tenant.
**Rationale:** Simpler operations for a solo developer. Sufficient isolation for the use case. Dedicated test tenant enables production E2E testing.

### 7. ABAC Authorization (starting with roles)

**Decision:** Attribute-Based Access Control with role-based permissions as the initial attribute set. Policy engine in shared domain package.
**Rationale:** More flexible than pure RBAC — can add attributes (ownership, time, tenant settings) later without changing the engine. Shared package means frontend and backend evaluate permissions identically.

### 8. Impersonation Support

**Decision:** Commands carry both `actingUserId` and `effectiveUserId`. ABAC evaluates against effective user. Acting user needs `can_impersonate` permission.
**Rationale:** Enables testing as different users, debugging user-reported issues, and combined with temporal queries: "what did this user see at this time?"

---

## Auth Decisions

### 9. Identity Model (User + Identity + Membership)

**Decision:** Three separate concepts — User (domain identity), Identity (external provider link), Membership (user ↔ tenant + role). A User can have multiple Identities. Email is optional on User but unique when present.
**Rationale:** Decouples authentication from domain identity. Supports multiple providers per user. Supports future auth methods (magic link, SMS) without schema changes. Email-based auto-merge on first login when provider verifies the email.

### 10. Google OIDC + Apple ID from Day One

**Decision:** Support both providers from the start.
**Rationale:** Avoids vendor-specific assumptions leaking into abstractions. Practical need (household members use different ecosystems).

### 11. JWT Access + Refresh Tokens

**Decision:** Short-lived JWT access tokens + longer-lived refresh tokens. Token handling via `jose` library.
**Rationale:** Stateless auth works well with offline-first — frontend can validate tokens locally. `jose` is battle-tested; crypto is not a place to learn by building.

### 12. Dev Bypass Auth

**Decision:** `DEV_AUTH_BYPASS=true` env var enables a `/dev/login` endpoint that issues JWTs without OIDC.
**Rationale:** Removes OIDC friction from local development, integration tests, and agent workflows.

---

## Tech Stack Decisions

### 13. TypeScript End-to-End

**Decision:** TypeScript for all packages (domain, api, web).
**Rationale:** Type safety across the full stack. Shared domain package would be impractical with mixed languages.

### 14. Node.js + Express (Backend)

**Decision:** Node.js runtime with Express HTTP framework.
**Rationale:** Mature, well-understood, excellent library ecosystem. Agents are highly productive with Express.

### 15. React PWA (Frontend)

**Decision:** React with Vite, deployed as a Progressive Web App. No meta-framework.
**Rationale:** Phone-first interaction model needs installable web app. PWA avoids native app complexity. Vite for fast dev experience. No Remix/Next because the backend is a separate service.

### 16. PostgreSQL

**Decision:** PostgreSQL for event store and projections.
**Rationale:** Battle-tested, strong JSON support, great ordering guarantees, can host both events and read models in one instance to start.

### 17. Yarn with node-modules Linker

**Decision:** Yarn (Berry) as package manager, configured with `nodeLinker: node-modules` (no PnP).
**Rationale:** Familiarity from AppFarm. node-modules linker avoids PnP compatibility issues.

### 18. Turborepo

**Decision:** Turborepo for monorepo build orchestration.
**Rationale:** Handles task dependencies, caching, and selective execution across packages. Familiar from AppFarm.

### 19. Vitest (Testing)

**Decision:** Vitest for unit and integration tests. Testing trophy approach (mostly integration tests). EARS methodology for test organization.
**Rationale:** Fast, TypeScript-native, good DX. Testing trophy aligns with event sourcing — domain behavior tests are integration-level but still fast (no I/O).

### 20. Playwright (E2E)

**Decision:** Playwright for end-to-end tests, running against dedicated test tenant.
**Rationale:** Best-in-class browser automation. Test tenant isolation means E2E can run against production.

### 21. oxlint + Lefthook

**Decision:** oxlint for linting, Lefthook for git hooks (replaces Husky + lint-staged). oxfmt for formatting if stable, Prettier as fallback.
**Rationale:** oxlint is fast (Rust-based). Lefthook is a single binary with native staged-file filtering — eliminates need for lint-staged as a separate dependency.

### 22. Docker Compose → Pulumi

**Decision:** Docker Compose for Phase 1 (local dev + VPS deployment). Pulumi (TypeScript) for Phase 2 when infra complexity warrants it.
**Rationale:** Compose is simple and sufficient for a single VPS. Dockerfiles aren't throwaway — Pulumi will deploy the same containers. Compose stays for local dev even after Pulumi adoption.

### 23. GitHub Actions (CI/CD)

**Decision:** GitHub Actions for CI (lint, typecheck, test on PR) and CD (deploy on merge to main).
**Rationale:** Free for public repos. Native GitHub integration.

---

## Development Workflow Decisions

### 24. Agent-Driven Development with Claude Code

**Decision:** Claude Code as primary implementation tool. CLAUDE.md files at root and per package. `.claude/` directory with specialized agents (recap, review).
**Rationale:** Maximizes productivity for solo intermittent development. Agents work best with clear package boundaries and focused context docs.

### 25. Session Logs

**Decision:** `docs/sessions/YYYY-MM-DD.md` written at the end of each working session.
**Rationale:** Enables the "recap" agent and helps Martin re-orient when returning after a break. Richer than git history alone.

### 26. Living Documentation in Repo

**Decision:** Architecture docs, plans, and ADRs live as markdown in the repo.
**Rationale:** Co-located with code, versioned in git, accessible to both humans and agents. Easy to update incrementally.

### 27. TDD with EARS Methodology

**Decision:** Test-Driven Development using EARS patterns to organize tests.
**Rationale:** Event-driven EARS pattern maps directly to projection tests. State-driven pattern maps to aggregate command handler tests. Provides consistent structure across bounded contexts.

---

## Deployment Decisions

### 28. Target: VPS (Hetzner or similar)

**Decision:** Self-hosted on a VPS initially, with potential move to home server later.
**Rationale:** Low cost, full control, no vendor lock-in. Docker Compose makes the deployment portable.

---

## Deferred Decisions

These were discussed but explicitly deferred:

- **Notification delivery mechanism** — abstracted but not implemented. Design for extensibility (push, email, SMS per user preference).
- **Background job system** — likely BullMQ or similar, but not needed until notification/scheduler features are built.
- **Specific frontend state management** — to be decided when building the sync engine (Phase 3).
- **jj (Jujutsu) as local Git interface** — appealing UX improvements over Git, but deferred to avoid friction with Claude Code which uses Git commands directly. Can adopt later as a local-only workflow change with no repo/CI impact.

---

## Additional Tooling Decisions

### 29. Apache-2.0 License

**Decision:** Apache-2.0 over MIT.
**Rationale:** Equally permissive but includes explicit patent grant, providing better legal protection for both author and users.

### 30. Conventional Commits + Changesets

**Decision:** commitlint with `@commitlint/config-conventional` enforced via Lefthook commit-msg hook. `@changesets/cli` for version management and changelog generation.
**Rationale:** Conventional commits ensure structured git history from the first commit. Changesets is monorepo-aware, generates per-package changelogs, and automates GitHub Releases. Lighter and more controllable than semantic-release, fitting the intermittent hobby workflow.

### 31. Git (not jj) from Day One

**Decision:** Use standard Git. Revisit jj later as a local workflow enhancement.
**Rationale:** Claude Code uses Git commands directly. Lefthook and commitlint rely on Git hooks. Adopting jj on day one adds friction with agent tooling for marginal benefit. jj can be adopted later since it uses a Git-compatible backend — the switch is low-cost and reversible with no impact on the repo, CI, or collaborators.
