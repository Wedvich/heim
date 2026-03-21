import { apiFetch } from "../api/fetch.ts";

export interface AggregateSnapshot {
  streamId: string;
  streamType: string;
  version: number;
  state: Record<string, unknown>;
}

export interface BootstrapResponse {
  snapshots: AggregateSnapshot[];
  cursor: string;
}

export async function fetchBootstrap(): Promise<BootstrapResponse | null> {
  const res = await apiFetch("/api/sync/bootstrap", {
    credentials: "include",
  });

  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`bootstrap fetch failed: ${res.status}`);

  const data = (await res.json()) as BootstrapResponse;

  for (const snapshot of data.snapshots) {
    if (
      (snapshot.streamType === "User" || snapshot.streamType === "Tenant") &&
      typeof snapshot.state.createdAt === "string"
    ) {
      snapshot.state.createdAt = new Date(snapshot.state.createdAt);
    }
  }

  return data;
}
