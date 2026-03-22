import { makeAutoObservable, observable, runInAction } from "mobx";
import type { ProductTypeState, StockItemState, TenantState, UserState } from "@heim/domain";
import type { AggregateSnapshot } from "./api.ts";
import { ProductTypeModel } from "./product-type-model.ts";
import { StockItemModel } from "./stock-item-model.ts";
import { TenantModel } from "./tenant-model.ts";
import { UserModel } from "./user-model.ts";

export class SyncStore {
  readonly productTypes = observable.map<string, ProductTypeModel>();
  readonly stockItems = observable.map<string, StockItemModel>();
  readonly tenants = observable.map<string, TenantModel>();
  readonly users = observable.map<string, UserModel>();
  cursor = "";
  status: "idle" | "loading" | "ready" | "error" = "idle";

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
}

export const syncStore = new SyncStore();
