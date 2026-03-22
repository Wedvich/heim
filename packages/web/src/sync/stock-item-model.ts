import { computed, makeObservable } from "mobx";
import {
  applyStockItemEvent,
  INITIAL_STOCK_ITEM_STATE,
  type StockItemEvent,
  type StockItemLevel,
  type StockItemState,
} from "@heim/domain";
import { Model } from "./model.ts";

export class StockItemModel extends Model<StockItemState, StockItemEvent> {
  constructor(
    streamId: string,
    initialState: StockItemState = INITIAL_STOCK_ITEM_STATE,
    initialVersion: number = 0,
  ) {
    super(streamId, "StockItem", initialState, initialVersion);

    makeObservable(this, {
      productTypeId: computed,
      level: computed,
      discarded: computed,
      expiryDate: computed,
    });
  }

  protected override fold(state: StockItemState, event: StockItemEvent): StockItemState {
    return applyStockItemEvent(state, event);
  }

  get productTypeId(): string | null {
    return this._state.productTypeId;
  }

  get level(): StockItemLevel | null {
    return this._state.level;
  }

  get discarded(): boolean {
    return this._state.discarded;
  }

  get expiryDate(): string | null {
    return this._state.expiryDate;
  }
}
