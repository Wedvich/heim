import { computed, makeObservable } from "mobx";
import {
  applyUserEvent,
  INITIAL_USER_STATE,
  type HydratedUserEvent,
  type UserState,
} from "@heim/domain";
import { Model } from "./model.ts";

export class UserModel extends Model<UserState, HydratedUserEvent> {
  constructor(
    streamId: string,
    initialState: UserState = INITIAL_USER_STATE,
    initialVersion: number = 0,
  ) {
    super(streamId, "User", initialState, initialVersion);

    makeObservable(this, {
      displayName: computed,
      email: computed,
      avatarUrl: computed,
    });
  }

  protected override fold(state: UserState, event: HydratedUserEvent): UserState {
    return applyUserEvent(state, event);
  }

  get displayName(): string | undefined {
    return this._state.displayName;
  }

  get email(): string | undefined {
    return this._state.email;
  }

  get avatarUrl(): string | undefined {
    return this._state.avatarUrl;
  }
}
