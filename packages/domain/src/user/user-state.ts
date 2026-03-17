export interface UserState {
  readonly principalId: string | null;
  readonly createdAt: Date | null;
  readonly provider: string | null;
  readonly displayName?: string | undefined;
  readonly email?: string | undefined;
  readonly avatarUrl?: string | undefined;
}

export const INITIAL_USER_STATE: UserState = {
  principalId: null,
  createdAt: null,
  provider: null,
};
