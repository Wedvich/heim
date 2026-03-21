import { Navigate } from "react-router";
import { useAuth } from "../auth/auth-context";

export function RootRedirect(): React.ReactElement {
  const { status, session } = useAuth();

  if (status === "loading") return <p>Loading…</p>;

  if (status === "authenticated" && session?.tenant) {
    return <Navigate to={`/${session.tenant.slug}/`} replace />;
  }

  return <Navigate to="/login" replace />;
}
