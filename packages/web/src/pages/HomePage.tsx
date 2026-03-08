import { Link } from "react-router";
import { useAuth } from "../auth/auth-context";

export function HomePage() {
  const { session, logout } = useAuth();

  return (
    <div style={{ padding: 32 }}>
      <h1>Heim</h1>
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
