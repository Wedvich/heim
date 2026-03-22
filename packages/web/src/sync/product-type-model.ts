import { computed, makeObservable } from "mobx";
import {
  applyProductTypeEvent,
  INITIAL_PRODUCT_TYPE_STATE,
  type ProductTypeEvent,
  type ProductTypeState,
} from "@heim/domain";
import { Model } from "./model.ts";

export class ProductTypeModel extends Model<ProductTypeState, ProductTypeEvent> {
  constructor(
    streamId: string,
    initialState: ProductTypeState = INITIAL_PRODUCT_TYPE_STATE,
    initialVersion: number = 0,
  ) {
    super(streamId, "ProductType", initialState, initialVersion);

    makeObservable(this, {
      name: computed,
      category: computed,
    });
  }

  protected override fold(state: ProductTypeState, event: ProductTypeEvent): ProductTypeState {
    return applyProductTypeEvent(state, event);
  }

  get name(): string | null {
    return this._state.name;
  }

  get category(): string | null {
    return this._state.category;
  }
}
