import type { PoolClient } from "pg";
import type { DomainEvent } from "@heim/domain";
import type { KeyManagementService } from "../crypto/kms.ts";
import { decryptPayload } from "../crypto/payload-encryption.ts";

export interface HydratedTenantEvent extends DomainEvent {
  readonly globalPosition: string;
  readonly pii?: Record<string, unknown>;
}

interface TenantEventRow {
  id: string;
  tenant_id: string;
  stream_id: string;
  stream_type: string;
  stream_position: number;
  global_position: string;
  event_type: string;
  correlation_id: string;
  causation_id: string;
  acting_principal_id: string;
  effective_principal_id: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  actual_time: Date;
  encrypted_payload: Buffer | null;
  fp_principal_id: string | null;
  encrypted_key: Buffer | null;
  mek_version: number | null;
}

export async function loadTenantEvents(
  client: PoolClient,
  kms: KeyManagementService,
  tenantId: string,
): Promise<HydratedTenantEvent[]> {
  const { rows } = await client.query<TenantEventRow>(
    `SELECT e.id, e.tenant_id, e.stream_id, e.stream_type, e.stream_position,
            e.global_position, e.event_type, e.correlation_id, e.causation_id,
            e.acting_principal_id, e.effective_principal_id,
            e.payload, e.metadata, e.actual_time,
            fp.encrypted_payload, fp.principal_id AS fp_principal_id,
            fpk.encrypted_key, fpk.mek_version
     FROM events e
     LEFT JOIN forgettable_payloads fp
       ON fp.tenant_id = e.tenant_id AND fp.event_id = e.id
     LEFT JOIN forgettable_payload_keys fpk
       ON fpk.principal_id = fp.principal_id
     WHERE e.tenant_id = $1
     ORDER BY e.global_position`,
    [tenantId],
  );

  if (rows.length === 0) return [];

  const dekCache = new Map<string, Buffer>();

  const events: HydratedTenantEvent[] = [];

  for (const row of rows) {
    let pii: Record<string, unknown> | undefined;

    if (
      row.encrypted_payload &&
      row.fp_principal_id &&
      row.encrypted_key &&
      row.mek_version != null
    ) {
      let dek = dekCache.get(row.fp_principal_id);
      if (!dek) {
        dek = await kms.decryptDek(row.encrypted_key, row.mek_version);
        dekCache.set(row.fp_principal_id, dek);
      }
      const decrypted = decryptPayload(row.encrypted_payload, dek);
      pii = JSON.parse(decrypted.toString("utf8")) as Record<string, unknown>;
    }

    events.push({
      id: row.id,
      tenantId: row.tenant_id,
      streamId: row.stream_id,
      streamType: row.stream_type,
      streamPosition: row.stream_position,
      globalPosition: row.global_position,
      eventType: row.event_type,
      correlationId: row.correlation_id,
      causationId: row.causation_id,
      actingPrincipalId: row.acting_principal_id,
      effectivePrincipalId: row.effective_principal_id,
      payload: row.payload,
      metadata: row.metadata,
      actualTime: row.actual_time,
      pii,
    });
  }

  return events;
}
