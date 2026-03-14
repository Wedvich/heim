import type { PoolClient } from "pg";
import type { DomainEvent } from "@heim/domain";

export async function appendEvents(client: PoolClient, events: DomainEvent[]): Promise<void> {
  for (const event of events) {
    await client.query(
      `INSERT INTO events (
        id, tenant_id, stream_id, stream_type, stream_position,
        event_type, correlation_id, causation_id,
        acting_principal_id, effective_principal_id,
        payload, metadata, actual_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        event.id,
        event.tenantId,
        event.streamId,
        event.streamType,
        event.streamPosition,
        event.eventType,
        event.correlationId,
        event.causationId,
        event.actingPrincipalId,
        event.effectivePrincipalId,
        JSON.stringify(event.payload),
        JSON.stringify(event.metadata),
        event.actualTime,
      ],
    );
  }
}
