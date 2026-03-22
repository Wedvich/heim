import type { DomainEvent } from "@heim/domain";
import type { PoolClient } from "pg";

interface EventRow {
  id: string;
  tenant_id: string;
  stream_id: string;
  stream_type: string;
  stream_position: number;
  event_type: string;
  correlation_id: string;
  causation_id: string;
  acting_principal_id: string;
  effective_principal_id: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  actual_time: Date;
}

export async function loadStreamEvents(
  client: PoolClient,
  tenantId: string,
  streamId: string,
): Promise<DomainEvent[]> {
  const { rows } = await client.query<EventRow>(
    `SELECT id, tenant_id, stream_id, stream_type, stream_position,
            event_type, correlation_id, causation_id,
            acting_principal_id, effective_principal_id,
            payload, metadata, actual_time
     FROM events
     WHERE tenant_id = $1 AND stream_id = $2
     ORDER BY stream_position`,
    [tenantId, streamId],
  );

  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    streamId: row.stream_id,
    streamType: row.stream_type,
    streamPosition: row.stream_position,
    eventType: row.event_type,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    actingPrincipalId: row.acting_principal_id,
    effectivePrincipalId: row.effective_principal_id,
    payload: row.payload,
    metadata: row.metadata,
    actualTime: row.actual_time,
  }));
}
