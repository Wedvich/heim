export interface TenantMember {
  readonly role: string;
  readonly joinedAt: Date;
}

export interface TenantState {
  readonly tenantId: string | null;
  readonly name: string | null;
  readonly slug: string | null;
  readonly createdAt: Date | null;
  readonly members: Readonly<Record<string, TenantMember>>;
}

export const INITIAL_TENANT_STATE: TenantState = {
  tenantId: null,
  name: null,
  slug: null,
  createdAt: null,
  members: {},
};
