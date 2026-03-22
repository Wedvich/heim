import { makeAutoObservable, observable, runInAction } from "mobx";
import type {
  DomainEvent,
  ProductTypeState,
  StockItemState,
  TenantState,
  UserState,
} from "@heim/domain";
import type { AggregateSnapshot } from "./api.ts";
import type { Model } from "./model.ts";
import { ProductTypeModel } from "./product-type-model.ts";
import { StockItemModel } from "./stock-item-model.ts";
import { TenantModel } from "./tenant-model.ts";
import { UserModel } from "./user-model.ts";

interface PendingCommand {
  readonly commandId: string;
  readonly streamId: string;
  readonly streamType: string;
}

export class SyncStore {
  readonly productTypes = observable.map<string, ProductTypeModel>();
  readonly stockItems = observable.map<string, StockItemModel>();
  readonly tenants = observable.map<string, TenantModel>();
  readonly users = observable.map<string, UserModel>();
  cursor = "";
  status: "idle" | "loading" | "ready" | "error" = "idle";

  /** Commands awaiting server confirmation, in submission order. */
  readonly #pendingCommands: PendingCommand[] = [];

  /** Speculative events keyed by commandId. */
  readonly #speculativeEvents = new Map<string, DomainEvent[]>();

  constructor() {
    makeAutoObservable(this, {
      productTypes: false,
      stockItems: false,
      tenants: false,
      users: false,
    });
  }

  loadSnapshots(snapshots: AggregateSnapshot[], cursor: string): void {
    runInAction(() => {
      this.productTypes.clear();
      this.stockItems.clear();
      this.tenants.clear();
      this.users.clear();
      this.#pendingCommands.length = 0;
      this.#speculativeEvents.clear();

      for (const snapshot of snapshots) {
        if (snapshot.streamType === "ProductType") {
          const model = new ProductTypeModel(
            snapshot.streamId,
            snapshot.state as unknown as ProductTypeState,
            snapshot.version,
          );
          this.productTypes.set(snapshot.streamId, model);
        } else if (snapshot.streamType === "StockItem") {
          const model = new StockItemModel(
            snapshot.streamId,
            snapshot.state as unknown as StockItemState,
            snapshot.version,
          );
          this.stockItems.set(snapshot.streamId, model);
        } else if (snapshot.streamType === "Tenant") {
          const model = new TenantModel(
            snapshot.streamId,
            snapshot.state as unknown as TenantState,
            snapshot.version,
          );
          this.tenants.set(snapshot.streamId, model);
        } else if (snapshot.streamType === "User") {
          const model = new UserModel(
            snapshot.streamId,
            snapshot.state as unknown as UserState,
            snapshot.version,
          );
          this.users.set(snapshot.streamId, model);
        }
        // Unknown stream types silently skipped
      }

      this.cursor = cursor;
      this.status = "ready";
    });
  }

  /** Register speculative events and apply them optimistically. */
  dispatch(commandId: string, streamId: string, streamType: string, events: DomainEvent[]): void {
    this.#pendingCommands.push({ commandId, streamId, streamType });
    this.#speculativeEvents.set(commandId, events);

    const model = this.#getModel(streamId, streamType);
    if (model) {
      for (const event of events) {
        model.applyEvent(event);
      }
    }
  }

  /** Confirm a command: advance confirmed baseline, re-derive with remaining speculative. */
  confirmCommand(commandId: string, authoritativeEvents: DomainEvent[]): void {
    const pending = this.#removePending(commandId);
    if (!pending) return;

    const speculativeEvents = this.#speculativeEvents.get(commandId);
    this.#speculativeEvents.delete(commandId);

    // Dev aid: log payload divergence
    if (speculativeEvents && import.meta.env.DEV) {
      this.#logDivergence(speculativeEvents, authoritativeEvents);
    }

    const model = this.#getModel(pending.streamId, pending.streamType);
    if (model) {
      model.advanceConfirmed(authoritativeEvents);
      this.#rederiveModel(model, pending.streamId);
    }
  }

  /** Reject a command: remove speculative events, re-derive from confirmed. */
  rejectCommand(commandId: string): void {
    const pending = this.#removePending(commandId);
    if (!pending) return;

    this.#speculativeEvents.delete(commandId);

    const model = this.#getModel(pending.streamId, pending.streamType);
    if (model) {
      this.#rederiveModel(model, pending.streamId);
    }
  }

  #removePending(commandId: string): PendingCommand | undefined {
    const idx = this.#pendingCommands.findIndex((p) => p.commandId === commandId);
    if (idx === -1) return undefined;
    return this.#pendingCommands.splice(idx, 1)[0];
  }

  /** Collect remaining speculative events for a stream and re-derive the model. */
  #rederiveModel(model: Model<unknown, DomainEvent>, streamId: string): void {
    const remaining: DomainEvent[] = [];
    for (const cmd of this.#pendingCommands) {
      if (cmd.streamId !== streamId) continue;
      const events = this.#speculativeEvents.get(cmd.commandId);
      if (events) remaining.push(...events);
    }
    model.rederive(remaining);
  }

  #getModel(streamId: string, streamType: string): Model<unknown, DomainEvent> | undefined {
    switch (streamType) {
      case "ProductType":
        return this.productTypes.get(streamId);
      case "StockItem":
        return this.stockItems.get(streamId);
      case "Tenant":
        return this.tenants.get(streamId);
      case "User":
        return this.users.get(streamId);
      default:
        return undefined;
    }
  }

  #logDivergence(speculative: DomainEvent[], authoritative: DomainEvent[]): void {
    if (speculative.length !== authoritative.length) {
      console.warn(
        "[sync] Event count divergence: speculative=%d authoritative=%d",
        speculative.length,
        authoritative.length,
      );
      return;
    }
    for (let i = 0; i < speculative.length; i++) {
      const s = speculative[i]!;
      const a = authoritative[i]!;
      if (s.eventType !== a.eventType) {
        console.warn(
          "[sync] Event type divergence at index %d: %s vs %s",
          i,
          s.eventType,
          a.eventType,
        );
      } else if (JSON.stringify(s.payload) !== JSON.stringify(a.payload)) {
        console.warn("[sync] Payload divergence for %s at index %d", s.eventType, i);
      }
    }
  }
}

export const syncStore = new SyncStore();
