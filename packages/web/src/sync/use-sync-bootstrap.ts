import { useEffect } from "react";
import { runInAction } from "mobx";
import { useAuth } from "../auth/auth-context.tsx";
import { fetchBootstrap } from "./api.ts";
import { syncStore } from "./sync-store.ts";

export function useSyncBootstrap(): void {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== "authenticated") return;

    runInAction(() => {
      syncStore.status = "loading";
    });

    let cancelled = false;

    fetchBootstrap()
      .then((res) => {
        if (cancelled) return;
        if (res) {
          syncStore.loadSnapshots(res.snapshots, res.cursor);
        }
      })
      .catch(() => {
        if (cancelled) return;
        runInAction(() => {
          syncStore.status = "error";
        });
      });

    return () => {
      cancelled = true;
    };
  }, [status]);
}
