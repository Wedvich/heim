import { makeAutoObservable, observable, runInAction } from "mobx";
import type { TenantState, UserState } from "@heim/domain";
import type { AggregateSnapshot } from "./api.ts";
import { TenantModel } from "./tenant-model.ts";
import { UserModel } from "./user-model.ts";

export class SyncStore {
  readonly tenants = observable.map<string, TenantModel>();
  readonly users = observable.map<string, UserModel>();
  cursor = "";
  status: "idle" | "loading" | "ready" | "error" = "idle";

  constructor() {
    makeAutoObservable(this, { tenants: false, users: false });
  }

  loadSnapshots(snapshots: AggregateSnapshot[], cursor: string): void {
    runInAction(() => {
      this.tenants.clear();
      this.users.clear();

      for (const snapshot of snapshots) {
        if (snapshot.streamType === "Tenant") {
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
}

export const syncStore = new SyncStore();
