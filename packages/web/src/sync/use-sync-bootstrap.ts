import { useEffect, useState } from "react";
import { runInAction } from "mobx";
import { fetchBootstrap } from "./api.ts";
import { syncStore } from "./sync-store.ts";

type BootstrapStatus = "loading" | "ready" | "denied" | "error";

export function useSyncBootstrap(tenantSlug: string): BootstrapStatus {
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus>("loading");

  useEffect(() => {
    syncStore.reset();

    runInAction(() => {
      syncStore.status = "loading";
    });
    setBootstrapStatus("loading");

    let cancelled = false;

    fetchBootstrap()
      .then((res) => {
        if (cancelled) return;
        if (res) {
          syncStore.loadSnapshots(res.snapshots, res.cursor);
          setBootstrapStatus("ready");
        } else {
          // null means 401/403 — no access to this tenant
          setBootstrapStatus("denied");
        }
      })
      .catch(() => {
        if (cancelled) return;
        runInAction(() => {
          syncStore.status = "error";
        });
        setBootstrapStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  return bootstrapStatus;
}
