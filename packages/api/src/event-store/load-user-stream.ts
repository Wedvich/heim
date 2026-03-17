import type { PoolClient } from "pg";
import type { HydratedUserEvent } from "@heim/domain";
import type { KeyManagementService } from "../crypto/kms.ts";
import { getForgettablePayloadKey } from "../crypto/forgettable-payload-key-repository.ts";
import { decryptPayload } from "../crypto/payload-encryption.ts";

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
  encrypted_payload: Buffer | null;
}

export async function loadHydratedUserStream(
  client: PoolClient,
  kms: KeyManagementService,
  tenantId: string,
  streamId: string,
): Promise<HydratedUserEvent[]> {
  const { rows } = await client.query<EventRow>(
    `SELECT e.id, e.tenant_id, e.stream_id, e.stream_type, e.stream_position,
            e.event_type, e.correlation_id, e.causation_id,
            e.acting_principal_id, e.effective_principal_id,
            e.payload, e.metadata, e.actual_time,
            fp.encrypted_payload
     FROM events e
     LEFT JOIN forgettable_payloads fp
       ON fp.tenant_id = e.tenant_id AND fp.event_id = e.id
     WHERE e.tenant_id = $1 AND e.stream_id = $2 AND e.stream_type = 'User'
     ORDER BY e.stream_position`,
    [tenantId, streamId],
  );

  if (rows.length === 0) return [];

  let dek: Buffer | null = null;
  const keyRecord = await getForgettablePayloadKey(client, streamId);
  if (keyRecord) {
    dek = await kms.decryptDek(keyRecord.encryptedKey, keyRecord.mekVersion);
  }

  return rows.map((row) => {
    let pii: Record<string, unknown> | undefined;
    if (row.encrypted_payload && dek) {
      const decrypted = decryptPayload(row.encrypted_payload, dek);
      pii = JSON.parse(decrypted.toString("utf8")) as Record<string, unknown>;
    }

    return {
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
      pii,
    } as HydratedUserEvent;
  });
}
