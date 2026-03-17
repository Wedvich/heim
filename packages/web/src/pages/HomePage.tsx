import { Link } from "react-router";
import { useAuth } from "../auth/auth-context";
import { useUser } from "../user/user-context";

export function HomePage() {
  const { session, logout } = useAuth();
  const { user } = useUser();

  return (
    <div style={{ padding: 32 }}>
      <h1>Heim</h1>
      {user?.displayName && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          {user.avatarUrl && (
            <img
              src={user.avatarUrl}
              alt=""
              style={{ width: 36, height: 36, borderRadius: "50%" }}
            />
          )}
          <span>{user.displayName}</span>
        </div>
      )}
      {session?.tenant && (
        <p>
          {session.tenant.name}
          {session.membership && ` · ${session.membership.role}`}
        </p>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Link to="/settings" style={{ padding: "8px 16px" }}>
          Settings
        </Link>
        <button onClick={() => void logout()} style={{ padding: "8px 16px", cursor: "pointer" }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
