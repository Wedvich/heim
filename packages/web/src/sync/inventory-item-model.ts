import { computed, makeObservable } from "mobx";
import {
  applyInventoryItemEvent,
  INITIAL_INVENTORY_ITEM_STATE,
  type InventoryItemEvent,
  type InventoryItemLevel,
  type InventoryItemState,
} from "@heim/domain";
import { Model } from "./model.ts";

export class InventoryItemModel extends Model<InventoryItemState, InventoryItemEvent> {
  constructor(
    streamId: string,
    initialState: InventoryItemState = INITIAL_INVENTORY_ITEM_STATE,
    initialVersion: number = 0,
  ) {
    super(streamId, "InventoryItem", initialState, initialVersion);

    makeObservable(this, {
      productTypeId: computed,
      level: computed,
      discarded: computed,
      expiryDate: computed,
    });
  }

  protected override fold(
    state: InventoryItemState,
    event: InventoryItemEvent,
  ): InventoryItemState {
    return applyInventoryItemEvent(state, event);
  }

  get productTypeId(): string | null {
    return this._state.productTypeId;
  }

  get level(): InventoryItemLevel | null {
    return this._state.level;
  }

  get discarded(): boolean {
    return this._state.discarded;
  }

  get expiryDate(): string | null {
    return this._state.expiryDate;
  }
}
