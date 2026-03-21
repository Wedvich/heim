import { computed, makeObservable } from "mobx";
import {
  applyTenantEvent,
  INITIAL_TENANT_STATE,
  type TenantEvent,
  type TenantState,
} from "@heim/domain";
import { Model } from "./model.ts";

export class TenantModel extends Model<TenantState, TenantEvent> {
  constructor(
    streamId: string,
    initialState: TenantState = INITIAL_TENANT_STATE,
    initialVersion: number = 0,
  ) {
    super(streamId, "Tenant", initialState, initialVersion);

    makeObservable(this, {
      name: computed,
      slug: computed,
    });
  }

  protected override fold(state: TenantState, event: TenantEvent): TenantState {
    return applyTenantEvent(state, event);
  }

  get name(): string | null {
    return this._state.name;
  }

  get slug(): string | null {
    return this._state.slug;
  }
}
