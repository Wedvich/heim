import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth/auth-context";

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <p>Loading…</p>;
  if (status === "unauthenticated") {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  return <Outlet />;
}
