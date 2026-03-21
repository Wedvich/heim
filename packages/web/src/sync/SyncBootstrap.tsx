import { useSyncBootstrap } from "./use-sync-bootstrap.ts";

export function SyncBootstrap({ children }: { children: React.ReactNode }) {
  useSyncBootstrap();
  return children;
}
