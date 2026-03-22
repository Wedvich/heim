# Sync Engine Architecture

## Overview

Heim uses an offline-first sync engine inspired by Linear's sync model. The frontend maintains local state, produces commands, and speculatively applies them for instant UI feedback. The backend is the authoritative source of events. Both sides share the same domain logic (`@heim/domain`) — command handlers and fold functions run identically on client and server.

## Design decisions

| Concern            | Decision                                                               | Rationale                                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Optimistic updates | Speculative events (not optimistic state)                              | One code path: shared command handler produces events, shared fold applies them. No separate "preview state" logic.                                   |
| Bootstrap          | Server sends folded aggregate states + sync cursor                     | Fast initial load. Client doesn't fold hundreds of events on cold start. Forgettable payload decryption stays server-side.                            |
| Delta sync         | Server sends raw hydrated events after cursor                          | Efficient incremental updates — only the diff. Client already has fold logic for speculative commands.                                                |
| Command response   | Hybrid — events in response now, migrate to sync-only later            | Get end-to-end flow working with minimal infrastructure. When SSE/WS lands, remove events from response.                                              |
| Client persistence | In-memory for now, IndexedDB later                                     | Reduces initial scope. Core abstractions don't change when persistence layer is added.                                                                |
| Confirmation model | Trust server, log payload divergence as soft conflict                  | Catches handler asymmetry bugs during development without blocking the UI.                                                                            |
| Command routing    | Single endpoint, registry dispatches to handler                        | One `POST /api/sync/commands` — the registry routes by `streamType`.                                                                                  |
| UUIDs              | UUIDv7 for event IDs and command IDs                                   | B-tree locality for time-ordered inserts. Generated in `@heim/domain` via the `uuid` package. CRUD table PKs remain v4 (`gen_random_uuid()`) for now. |
| Frontend state     | MobX observable models with typed subclasses                           | Reactive updates, computed properties, cross-model relations. `@heim/domain` stays MobX-unaware.                                                      |
| Fold/MobX bridge   | Pure fold → `@observable.ref` state assignment                         | Single source of truth in `@heim/domain`. Model holds fold result directly, computed getters expose fields. No `patch()` or `toState()`.              |
| Model layer        | Abstract base `Model<TState, TEvent>` + typed subclasses per aggregate | Shared lifecycle (state, version, event application) in base. Computed getters, relations on subclasses.                                              |

## Frontend state management (MobX)

The frontend uses MobX for reactive state. Aggregate states are observable model objects — when events are applied, MobX detects property changes and triggers re-renders only in affected components.

### Model layer

A shared abstract `Model<TState, TEvent>` base class handles sync plumbing and the event application lifecycle. The model holds the fold result directly as an `@observable.ref` state — computed getters expose fields to MobX observers.

```typescript
// Base — owns state, version, confirmed baseline, and event application
abstract class Model<TState, TEvent extends DomainEvent> {
  readonly streamId: string;
  readonly streamType: string;
  @observable.ref protected _state: TState; // ref — tracks replacement, not deep
  #version: number;              // private — internal sync bookkeeping
  #confirmedState: TState;       // baseline for rollback/rederive
  #confirmedVersion: number;

  // Subclass provides the pure fold from @heim/domain
  protected abstract fold(state: TState, event: TEvent): TState;

  get state(): TState { return this._state; }
  get version(): number { return this.#version; }
  get confirmedVersion(): number { return this.#confirmedVersion; }

  // Apply a single event (speculative or authoritative)
  applyEvent(event: TEvent): void {
    runInAction(() => {
      this._state = this.fold(this._state, event);
      this.#version = event.streamPosition;
    });
  }

  // Advance the confirmed baseline (after authoritative events arrive)
  advanceConfirmed(events: readonly TEvent[]): void { ... }

  // Reset to confirmed state, then replay speculative events
  rederive(speculativeEvents: readonly TEvent[]): void { ... }
}

// Typed subclass — computed getters + domain fold + computeds/relations
class UserModel extends Model<UserState, HydratedUserEvent> {
  @computed get displayName() {
    return this._state.displayName;
  }
  @computed get email() {
    return this._state.email;
  }
  @computed get avatarUrl() {
    return this._state.avatarUrl;
  }

  protected fold(state: UserState, event: HydratedUserEvent): UserState {
    return applyUserEvent(state, event); // from @heim/domain
  }

  @computed get initials(): string {
    return (
      this.displayName
        ?.split(" ")
        .map((w) => w[0])
        .join("") ?? "?"
    );
  }
}
```

`@observable.ref` on `_state` tells MobX to track reference replacement, not deep property changes. When `applyEvent` assigns a new state object, all computed getters re-evaluate. MobX's computed caching ensures observers are only notified when their specific value actually changed — a component reading `email` won't re-render when only `displayName` changed.

The model tracks two parallel state lines: **confirmed** (the last server-acknowledged state) and **current** (confirmed + speculative events). `advanceConfirmed` moves the baseline forward when authoritative events arrive. `rederive` resets to confirmed and replays remaining speculative events — used on both confirm and reject to keep the UI consistent.

No `patch()` or `toState()` methods needed — the fold result is the state, and the model exposes it through computed getters.

### Fold/MobX boundary

The pure fold functions in `@heim/domain` remain the single source of truth for state transitions. Each model subclass delegates to the domain fold via its `fold()` method. `@heim/domain` stays MobX-unaware — the observable assignment happens in the base class's `applyEvent`, after the pure fold returns.

### Store

The `SyncStore` holds typed observable maps per aggregate type, plus sync state:

```typescript
class SyncStore {
  readonly productTypes = observable.map<string, ProductTypeModel>();
  readonly stockItems = observable.map<string, StockItemModel>();
  readonly tenants = observable.map<string, TenantModel>();
  readonly users = observable.map<string, UserModel>();
  cursor = "";
  status: "idle" | "loading" | "ready" | "error" = "idle";

  // Private — managed via dispatch/confirmCommand/rejectCommand
  #pendingCommands: PendingCommand[];
  #speculativeEvents: Map<string, DomainEvent[]>;
}
```

### Relations

Models can reference each other through the store. Computed properties on the model resolve relations lazily:

```typescript
class MembershipModel extends Model {
  @observable principalId: string = "";

  @computed get principal(): UserModel | undefined {
    return this.store.users.get(this.principalId);
  }
}
```

### React integration

Components use MobX's `observer` wrapper. They read model properties directly — MobX tracks access and re-renders only when those specific properties change:

```tsx
const UserAvatar = observer(({ user }: { user: UserModel }) => (
  <div>
    <img src={user.avatarUrl} />
    <span>{user.initials}</span>
  </div>
));
```

## Command contract

Commands are the write interface. They are produced on the frontend, processed locally for speculative updates, and sent to the server for authoritative processing.

```typescript
interface Command {
  readonly commandId: string; // UUID, generated on frontend (idempotency key)
  readonly streamId: string; // target aggregate instance
  readonly streamType: string; // aggregate type (e.g. "User", "Inventory")
  readonly type: string; // command name (e.g. "AddItem", "CompleteChore")
  readonly payload: Record<string, unknown>;
  readonly expectedVersion: number; // client's current aggregate version
  readonly actualTime: Date; // when the action happened (set by frontend)
  readonly tenantId: string; // tenant scope
}
```

### Key properties

- `commandId` is a UUID generated on the frontend via `crypto.randomUUID()`. It serves as the idempotency key for network retries and the correlation key between speculative and authoritative events.
- `expectedVersion` is the `stream_position` of the latest confirmed event the client has seen for this aggregate. Enables optimistic concurrency — the server rejects if the aggregate has advanced past this version.
- `actualTime` is set by the frontend (not inside the handler). This ensures the handler is a pure function of its inputs.

## Command handler interface

Command handlers are pure functions: `(state, command) → events | error`. They live in `@heim/domain` and run on both frontend and backend.

```typescript
type CommandResult = { ok: true; events: DomainEvent[] } | { ok: false; reason: string };

interface CommandHandler<TState = unknown> {
  readonly streamType: string;
  handle(state: TState, command: Command): CommandResult;
}
```

### Handler rules

1. **Pure function.** No side effects, no I/O, no `new Date()`, no `crypto.randomUUID()` inside the handler. Timestamps and IDs come from the command or are injected by the caller.
2. **Deterministic.** Given identical `(state, command)`, the handler MUST produce identical events. This is what makes speculative events work — both sides produce the same output.
3. **No server-only enrichment inside the handler.** If the server needs to look up canonical data, stamp metadata, or perform validation against external systems, that happens _before_ calling the handler (as command pre-processing) or _after_ (as infrastructure side effects). The handler itself sees only state + command.

### Command handler registry

A single registry dispatches commands to handlers by `streamType`. Registered on both frontend and backend with the same set of handlers.

```typescript
class CommandHandlerRegistry {
  #handlers = new Map<string, CommandHandler>();

  register(handler: CommandHandler): this {
    if (this.#handlers.has(handler.streamType)) {
      throw new Error(`Handler already registered for: ${handler.streamType}`);
    }
    this.#handlers.set(handler.streamType, handler);
    return this;
  }

  handle(state: unknown, command: Command): CommandResult {
    const handler = this.#handlers.get(command.streamType);
    if (!handler) {
      return { ok: false, reason: `No handler for stream type: ${command.streamType}` };
    }
    return handler.handle(state, command);
  }
}
```

## Event identity

When the client and server both run the same command handler, the events differ in infrastructure fields but are semantically identical:

| Field             | Client (speculative) | Server (authoritative)   |
| ----------------- | -------------------- | ------------------------ |
| `id`              | Temporary UUID       | Permanent UUID           |
| `global_position` | Absent               | Assigned by sequence     |
| `record_time`     | Absent               | Set by DB                |
| `stream_position` | Predicted            | Authoritative            |
| `correlation_id`  | `command.commandId`  | `command.commandId`      |
| `payload`         | From handler         | From handler (identical) |

The `commandId` (stored as `correlation_id` on events) is the join key. The client matches speculative events to authoritative events by `commandId`, not by event ID.

## Bootstrap

### Endpoint

`GET /api/sync/bootstrap`

Returns folded aggregate states for all streams in the tenant the user has access to (initially: all streams in the tenant, ABAC filtering added later).

### Response shape

```typescript
interface BootstrapResponse {
  snapshots: AggregateSnapshot[];
  cursor: string; // global_position of latest event included
}

interface AggregateSnapshot {
  streamId: string;
  streamType: string;
  version: number; // latest stream_position
  state: Record<string, unknown>; // serialized folded state
}
```

### Server implementation

1. Load all events for the tenant, ordered by `global_position`
2. For each stream: fold events using the `@heim/domain` fold function, decrypting forgettable payloads server-side and baking PII into state fields
3. Return the folded snapshots + the highest `global_position` as cursor

### Pagination (future)

For large tenants, the response can be streamed as NDJSON (one snapshot per line). The cursor is still the highest `global_position` across all included snapshots. The client accumulates snapshots as they arrive and can render progressively.

## Command flow

### Frontend

```
User action
  → Build Command { commandId, streamId, type, payload, expectedVersion, actualTime }
  → Run handler: handleCommand(currentState, command) → speculative events
  → Tag events with commandId, add to speculativeEvents map
  → Add command to pendingCommands queue
  → Re-derive UI state: fold(confirmed + all speculative events in order)
  → Send command to server via sync client
```

### Server

```
POST /api/sync/commands
  → Parse command
  → Idempotency check: SELECT 1 FROM events WHERE correlation_id = commandId
    → If found: return existing events (replay response)
  → Load aggregate from event store
  → Validate expectedVersion against current stream_position
    → If mismatch: reject with "version_conflict"
  → Run handler: handleCommand(authoritativeState, command) → events
  → Append events to event store with correlation_id = commandId
  → Return CommandResponse with events
```

### Endpoint

`POST /api/sync/commands`

### Request / response

```typescript
// Request body is a Command (see above)

interface CommandResponse {
  status: "accepted" | "rejected";
  commandId: string;
  events?: AuthoritativeEvent[]; // present when accepted
  reason?: string; // present when rejected
  cursor?: string; // new global_position (when accepted)
}
```

## Confirmation and rollback

### On acceptance

1. Find speculative events keyed by `commandId`
2. Compare speculative event payloads against authoritative event payloads
3. If payloads differ: log a soft conflict warning (development aid — indicates handler impurity)
4. Replace speculative events with authoritative events
5. Move authoritative events into confirmed state, advance cursor
6. Remove command from pending queue
7. Re-derive UI state: fold(confirmed + remaining speculative events)
8. If payloads were identical: UI state is unchanged, no flicker

### On rejection

1. Remove speculative events keyed by `commandId`
2. Remove command from pending queue
3. Re-derive UI state: fold(confirmed + remaining speculative events)
4. The optimistic change disappears from the UI
5. Surface rejection reason to the user (toast, inline error, etc.)

### Composition of multiple pending commands

Speculative events are always re-applied on top of confirmed state, in command submission order. If commands A and B are both pending:

- A confirms → A's authoritative events become confirmed, B's speculative events re-applied on top
- A rejects → A's speculative events removed, B's speculative events re-applied on confirmed state
- B confirms before A → B's authoritative events absorbed, A's speculative events still pending

The ordering invariant: `pendingCommands` is an ordered list by submission time. The re-derive function iterates in this order.

## Client state manager

```typescript
interface SyncState {
  confirmedSnapshots: Map<string, AggregateSnapshot>; // streamId → snapshot
  cursor: string; // global_position
  pendingCommands: Command[]; // ordered by submission time
  speculativeEvents: Map<string, DomainEvent[]>; // commandId → events
}

// Pure function — no side effects
function deriveUIState(syncState: SyncState): Map<string, unknown> {
  // Start with confirmed snapshots
  const states = new Map<string, unknown>();
  for (const [streamId, snapshot] of syncState.confirmedSnapshots) {
    states.set(streamId, snapshot.state);
  }

  // Apply speculative events in command submission order
  for (const command of syncState.pendingCommands) {
    const events = syncState.speculativeEvents.get(command.commandId);
    if (!events) continue;
    for (const event of events) {
      const currentState = states.get(event.streamId);
      if (currentState !== undefined) {
        states.set(event.streamId, applyEvent(currentState, event));
      }
    }
  }

  return states;
}
```

The `applyEvent` function dispatches to the correct fold based on `streamType` — same registry pattern as command handlers.

## Idempotency

Server-side deduplication uses `correlation_id` (which stores the `commandId`):

```sql
SELECT id, event_type, payload, stream_position, global_position
FROM events
WHERE tenant_id = $1 AND correlation_id = $2
ORDER BY stream_position
```

If results exist, return them as the command response without re-processing. This handles:

- Network retries (client sends same command twice due to timeout)
- Offline replay (client reconnects and resends queued commands)
- Browser refresh (if commands are later persisted in IndexedDB)

The `correlation_id` column is already indexed per-tenant: `idx_events_tenant_correlation_id`.

## Conflict detection

Conflicts are per-aggregate, detected via `expectedVersion`:

1. Client sends command with `expectedVersion: 4`
2. Server loads aggregate, finds current `stream_position: 5` (another command was processed in between)
3. Server rejects: `{ status: "rejected", reason: "version_conflict" }`
4. Client rolls back speculative events for this command

Two users modifying _different_ aggregates in the same tenant never conflict. This keeps the conflict surface small at household scale.

### Future: automatic retry on conflict

For simple, commutative operations (like incrementing a counter), the client could reload the aggregate state and re-run the command automatically. This is deferred — manual retry (user re-triggers the action) is sufficient initially.

## Delta sync (future)

### Endpoint

`GET /api/sync/delta?cursor={global_position}`

Returns hydrated events since the cursor. The client applies them via fold to update confirmed snapshots, then advances the cursor.

```typescript
interface DeltaSyncResponse {
  events: HydratedEvent[];
  cursor: string; // new global_position
}
```

Events include PII from forgettable payloads, hydrated server-side (same as bootstrap). The client applies each event to the matching confirmed snapshot using the fold function.

### Transition to push

When SSE or WebSocket support lands, delta sync becomes a push channel:

1. Client opens SSE connection with current cursor
2. Server pushes new events as they're committed
3. Client applies them via fold, advances cursor
4. Command responses no longer include events — they return a lightweight ack
5. Confirmation happens when the command's events arrive via the push channel (matched by `commandId` / `correlation_id`)

The client code barely changes: it already handles speculative → authoritative replacement keyed by `commandId`. The only difference is where the authoritative events arrive from.

## Forgettable payloads and the bootstrap/delta boundary

- **Bootstrap:** PII is decrypted server-side and baked into aggregate state fields (e.g. `displayName`, `email` on `UserState`). The client never sees the event/PII split. The crypto shredding boundary stays entirely server-side.
- **Delta sync:** Events arrive with PII hydrated into the event payload by the server (same as current `loadHydratedUserStream`). The client fold incorporates the PII into state.
- **Speculative events:** The client produces these from the command payload, which already contains the user's input (e.g. the display name they typed). No forgettable payload concern on the client side — that's a persistence-layer concept that only matters when events are stored.

## What changes from current code

| Current                             | New                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `GET /api/user/me/events`           | `GET /api/sync/bootstrap` (all tenant aggregates, folded state)         |
| `UserProvider` / `useUser()`        | `SyncStore` with MobX observable models + `observer` components         |
| No command infrastructure           | `Command` type + `CommandHandlerRegistry` + `POST /api/sync/commands`   |
| Events folded on client after fetch | Bootstrap sends pre-folded state; fold used for commands and delta sync |
| No optimistic updates               | Speculative events + pending command queue                              |

## New dependencies

| Package           | Where          | Purpose                                                                               |
| ----------------- | -------------- | ------------------------------------------------------------------------------------- |
| `uuid`            | `@heim/domain` | UUIDv7 generation for event IDs and command IDs (shared between frontend and backend) |
| `mobx`            | `@heim/web`    | Observable state, computed properties, reactive updates                               |
| `mobx-react-lite` | `@heim/web`    | `observer` HOC for React component integration                                        |

## Implementation order

1. **Command type + handler interface** in `@heim/domain` — the `Command`, `CommandResult`, `CommandHandler`, `CommandHandlerRegistry` types
2. **First command handler** — e.g. `UserCommandHandler` handling a simple command (rename user, or similar)
3. **`POST /api/sync/commands`** — single endpoint, registry dispatch, idempotency check, event append, return events
4. **`GET /api/sync/bootstrap`** — fold all tenant aggregates server-side, return snapshots + cursor
5. **Frontend MobX model layer** — `Model` base class, `UserModel` subclass, `SyncStore`, fold/patch bridge
6. **Wire it up** — replace `UserProvider` with `SyncStore` + `observer` components, send commands through sync client
7. **Delta sync endpoint** (when needed)
8. **IndexedDB persistence** (when offline support is prioritized)
9. **SSE/WS push channel** (when real-time multi-device sync is needed)
