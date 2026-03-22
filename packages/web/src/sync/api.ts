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

export interface SendCommandRequest {
  commandId: string;
  correlationId: string;
  causationId: string;
  streamId: string;
  streamType: string;
  type: string;
  payload: Record<string, unknown>;
  expectedVersion: number;
}

interface SendCommandSuccess {
  ok: true;
  events: Array<{
    id: string;
    tenantId: string;
    streamId: string;
    streamType: string;
    streamPosition: number;
    eventType: string;
    correlationId: string;
    causationId: string;
    actingPrincipalId: string;
    effectivePrincipalId: string | null;
    payload: Record<string, unknown>;
    metadata: Record<string, unknown>;
    actualTime: string;
  }>;
}

interface SendCommandError {
  ok: false;
  error: string;
  reason?: string;
}

export type SendCommandResponse = SendCommandSuccess | SendCommandError;

export async function sendCommand(request: SendCommandRequest): Promise<SendCommandResponse> {
  const res = await apiFetch("/api/sync/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(request),
  });

  if (res.status === 409) {
    const body = (await res.json()) as { error: string };
    return { ok: false, error: body.error };
  }

  if (res.status === 422) {
    const body = (await res.json()) as { error: string; reason: string };
    return { ok: false, error: body.error, reason: body.reason };
  }

  if (!res.ok) {
    return { ok: false, error: "internal_error" };
  }

  return (await res.json()) as SendCommandSuccess;
}
