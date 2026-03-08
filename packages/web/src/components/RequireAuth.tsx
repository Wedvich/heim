import { Navigate, Outlet } from "react-router";
import { useAuth } from "../auth/auth-context";

export function RequireAuth() {
  const { status } = useAuth();

  if (status === "loading") return <p>Loading…</p>;
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  return <Outlet />;
}
