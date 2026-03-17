export interface UserState {
  readonly principalId: string | null;
  readonly createdAt: Date | null;
  readonly provider: string | null;
  readonly displayName?: string;
  readonly email?: string;
  readonly avatarUrl?: string;
}

export const INITIAL_USER_STATE: UserState = {
  principalId: null,
  createdAt: null,
  provider: null,
};
