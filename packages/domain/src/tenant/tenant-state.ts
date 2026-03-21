export interface TenantState {
  readonly tenantId: string | null;
  readonly name: string | null;
  readonly slug: string | null;
  readonly createdAt: Date | null;
}

export const INITIAL_TENANT_STATE: TenantState = {
  tenantId: null,
  name: null,
  slug: null,
  createdAt: null,
};
