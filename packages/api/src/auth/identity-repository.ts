import type { Pool, PoolClient } from "pg";

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

export async function findPrincipalByEmailHash(
  client: PoolClient,
  emailHash: string,
): Promise<{ principalId: string } | null> {
  const result = await client.query<{ principal_id: string }>(
    `SELECT principal_id FROM identities WHERE email_hash = $1 LIMIT 1`,
    [emailHash],
  );
  const row = result.rows[0];
  return row ? { principalId: row.principal_id } : null;
}

export async function createIdentity(
  client: PoolClient,
  params: {
    principalId: string;
    provider: string;
    providerSubjectId: string;
    emailHash: string | null;
  },
): Promise<{ id: string }> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO identities (principal_id, provider, provider_subject_id, email_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [params.principalId, params.provider, params.providerSubjectId, params.emailHash],
  );
  return { id: result.rows[0].id };
}
