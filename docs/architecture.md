# Architecture

## CQRS + Event Sourcing

Heim follows a Command Query Responsibility Segregation pattern with Event Sourcing as the persistence mechanism.

**Write side:** Commands are validated against the current aggregate state. If valid, one or more events are produced and appended to the event store. Events are immutable facts.

**Read side:** Projections (read models) are built by folding over the event stream. Different projections serve different views (calendar, dashboard, shopping list). Projections are rebuildable from scratch at any time.

**Key principle:** Events are the source of truth. All state is derived from events.

## Bitemporal Data

Every event carries two temporal dimensions:

- **Record time** (transaction time) — when the event was recorded in the event store. Set by the system, immutable.
- **Actual time** (valid time) — when the thing actually happened in the real world. Set by the user/command, can differ from record time.

This enables queries like "show me the state of inventory _as the system knew it_ on January 15th" (record time) vs. "show me the state of inventory _as of_ January 15th" (actual time). See: https://martinfowler.com/articles/bitemporal-history.html

## Offline-First Sync with Optimistic Updates

The frontend maintains local state and provides instant feedback. Sync works as follows:

1. **User action** → creates a **Command**
2. **Frontend** speculatively applies the command using shared domain logic → user sees optimistic update immediately
3. **Command is sent to backend**
4. **Backend** validates the command against the authoritative aggregate state:
   - **Accept:** Backend produces the authoritative event, assigns a global sequence number, returns it to the frontend. Frontend confirms its speculative state.
   - **Reject (version conflict):** Frontend rolls back speculative state and replays from last confirmed state.
5. Conflict detection is **per-aggregate**: if the frontend modifies Aggregate A and the backend has meanwhile seen updates to Aggregate B, there is no conflict. Conflicts only occur when the same aggregate has been modified.

**Critical invariant:** Only the backend produces authoritative events. The frontend _previews_ the outcome using the same shared domain logic, but events aren't "real" until the backend confirms them. This keeps event semantics clean (events = facts) while providing the same code-sharing and instant-UI benefits.

## Multi-Tenancy

- Tenant ID column on all data (not schema-per-tenant)
- Every command and query is scoped to a tenant
- A user can be a member of multiple tenants
- A dedicated test tenant is used for E2E testing in production

## Authorization (ABAC)

Attribute-Based Access Control with role-based permissions as the initial attribute set.

**Policy evaluation:** `(subject, action, resource, context) → allow | deny`

- Initial subject attributes: `role` (owner, member, etc.)
- Future attributes: resource ownership, time-based, tenant-level settings, etc.
- The policy engine lives in the **shared domain package** so both frontend and backend evaluate permissions identically
- Frontend uses it for UI decisions (show/hide/disable); backend is authoritative

**Impersonation:**

- Commands carry both `actingUserId` and `effectiveUserId`
- ABAC evaluates against the effective user's attributes
- The acting user needs a `can_impersonate` permission
- Full audit trail: events record who actually performed the action and who they were impersonating

## Temporal Queries

Because the event store is bitemporal and projections are rebuildable, the system supports:

- "What did User X's dashboard look like on date Y?" — rebuild projection from events up to that point
- Combined with impersonation: "Show me what TestUser saw on January 15th"
- **Important:** Temporal queries are read-side only. Commands always execute against current state.

## Deployment Topology

**Production** (`compose.prod.yml`):

```
Client → nginx :80
           ├── /api/* → Express container :3000
           └── /*     → static files (Vite build output)
```

nginx is the single entry point. It serves the React PWA's static bundle directly and reverse-proxies API requests to the Express backend. This keeps the Node process focused on business logic and lets nginx handle TLS termination, compression, and static file caching.

**Local development** (`compose.yml` + Turborepo):

Vite's dev server handles both the frontend and API proxying via its built-in `server.proxy` config. No nginx is needed in dev — Postgres is the only containerized dependency.

---
