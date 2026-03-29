import { observer } from "mobx-react-lite";
import { useAuth } from "../../auth/auth-context";
import { syncStore } from "../../sync/sync-store";

export const AccountTab = observer(function AccountTab(): React.ReactElement {
  const { session, logout } = useAuth();
  const user = session ? syncStore.users.get(session.principal.id) : undefined;

  return (
    <div style={{ paddingTop: 24 }}>
      <h2 style={{ marginTop: 0 }}>Account</h2>

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        {user?.avatarUrl && (
          <img src={user.avatarUrl} alt="" style={{ width: 64, height: 64, borderRadius: "50%" }} />
        )}
        <div>
          {user?.displayName && (
            <div style={{ fontSize: 18, fontWeight: 500 }}>{user.displayName}</div>
          )}
          {user?.email && (
            <div style={{ color: "var(--color-text-secondary)", marginTop: 4 }}>{user.email}</div>
          )}
        </div>
      </div>

      {session?.membership && (
        <p style={{ color: "var(--color-text-secondary)" }}>Role: {session.membership.role}</p>
      )}

      <button
        onClick={() => void logout()}
        style={{ padding: "8px 16px", cursor: "pointer", marginTop: 16 }}
      >
        Sign out
      </button>
    </div>
  );
});
