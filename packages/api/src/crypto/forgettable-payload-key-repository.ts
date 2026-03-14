import type { PoolClient } from "pg";

export async function createForgettablePayloadKey(
  client: PoolClient,
  params: { principalId: string; encryptedDek: Buffer; mekVersion: number },
): Promise<void> {
  await client.query(
    `INSERT INTO forgettable_payload_keys (principal_id, encrypted_key, mek_version)
     VALUES ($1, $2, $3)
     ON CONFLICT (principal_id) DO NOTHING`,
    [params.principalId, params.encryptedDek, params.mekVersion],
  );
}

export async function getForgettablePayloadKey(
  client: PoolClient,
  principalId: string,
): Promise<{ encryptedKey: Buffer; mekVersion: number } | null> {
  const result = await client.query<{ encrypted_key: Buffer; mek_version: number }>(
    `SELECT encrypted_key, mek_version FROM forgettable_payload_keys WHERE principal_id = $1`,
    [principalId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { encryptedKey: row.encrypted_key, mekVersion: row.mek_version };
}
