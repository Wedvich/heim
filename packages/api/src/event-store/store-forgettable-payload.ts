import type { PoolClient } from "pg";
import { encryptPayload } from "../crypto/payload-encryption.ts";

export async function storeForgettablePayload(
  client: PoolClient,
  params: {
    eventId: string;
    tenantId: string;
    principalId: string;
    plaintext: Record<string, unknown>;
    dek: Buffer;
  },
): Promise<void> {
  const plaintextBuffer = Buffer.from(JSON.stringify(params.plaintext), "utf8");
  const encrypted = encryptPayload(plaintextBuffer, params.dek);
  await client.query(
    `INSERT INTO forgettable_payloads (event_id, tenant_id, principal_id, encrypted_payload)
     VALUES ($1, $2, $3, $4)`,
    [params.eventId, params.tenantId, params.principalId, encrypted],
  );
}
