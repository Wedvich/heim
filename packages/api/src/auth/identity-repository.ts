import type { Pool } from "pg";

export async function findPrincipalByProviderIdentity(
  db: Pool,
  provider: string,
  providerSubjectId: string,
): Promise<{ principalId: string } | null> {
  const result = await db.query<{ principal_id: string }>(
    `SELECT principal_id FROM identities WHERE provider = $1 AND provider_subject_id = $2`,
    [provider, providerSubjectId],
  );
  const row = result.rows[0];
  return row ? { principalId: row.principal_id } : null;
}
