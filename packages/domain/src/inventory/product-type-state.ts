export interface ProductTypeState {
  readonly productTypeId: string | null;
  readonly name: string | null;
  readonly category: string | null;
  readonly createdAt: Date | null;
}

export const INITIAL_PRODUCT_TYPE_STATE: ProductTypeState = {
  productTypeId: null,
  name: null,
  category: null,
  createdAt: null,
};
