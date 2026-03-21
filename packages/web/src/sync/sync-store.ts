import { makeAutoObservable, observable, runInAction } from "mobx";
import type { UserState } from "@heim/domain";
import type { AggregateSnapshot } from "./api.ts";
import { UserModel } from "./user-model.ts";

export class SyncStore {
  readonly users = observable.map<string, UserModel>();
  cursor = "";
  status: "idle" | "loading" | "ready" | "error" = "idle";

  constructor() {
    makeAutoObservable(this, { users: false });
  }

  reset(): void {
    runInAction(() => {
      this.users.clear();
      this.cursor = "";
      this.status = "idle";
    });
  }

  loadSnapshots(snapshots: AggregateSnapshot[], cursor: string): void {
    runInAction(() => {
      this.users.clear();

      for (const snapshot of snapshots) {
        if (snapshot.streamType === "User") {
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
