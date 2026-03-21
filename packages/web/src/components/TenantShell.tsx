import { useEffect } from "react";
import { Link, Outlet, useParams } from "react-router";
import { useAuth } from "../auth/auth-context";
import { setActiveTenantSlug } from "../api/fetch";
import { useSyncBootstrap } from "../sync/use-sync-bootstrap";

export function TenantShell(): React.ReactElement {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { session } = useAuth();

  useEffect(() => {
    setActiveTenantSlug(tenantSlug);
    return () => setActiveTenantSlug(undefined);
  }, [tenantSlug]);

  const bootstrapStatus = useSyncBootstrap(tenantSlug!);

  if (bootstrapStatus === "denied") {
    const defaultSlug = session?.tenant?.slug;
    return (
      <div style={{ padding: 32 }}>
        <h1>Access Denied</h1>
        <p>You don't have access to this workspace.</p>
        {defaultSlug && <Link to={`/${defaultSlug}/`}>Go to your workspace</Link>}
      </div>
    );
  }

  if (bootstrapStatus === "loading") {
    return <p>Loading…</p>;
  }

  if (bootstrapStatus === "error") {
    return (
      <div style={{ padding: 32 }}>
        <h1>Something went wrong</h1>
        <p>Failed to load workspace data. Please try refreshing.</p>
      </div>
    );
  }

  return <Outlet />;
}
