import type { PoolClient } from "pg";

export interface Invite {
  id: string;
  token: string;
  tenantId: string | null;
  role: string;
  createdBy: string;
  expiresAt: Date;
}

export async function findValidInvite(client: PoolClient, token: string): Promise<Invite | null> {
  const result = await client.query<{
    id: string;
    token: string;
    tenant_id: string | null;
    role: string;
    created_by: string;
    expires_at: Date;
  }>(
    `SELECT id, token, tenant_id, role, created_by, expires_at
     FROM invites
     WHERE token = $1 AND used_at IS NULL AND expires_at > now()
     FOR UPDATE`,
    [token],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    token: row.token,
    tenantId: row.tenant_id,
    role: row.role,
    createdBy: row.created_by,
    expiresAt: row.expires_at,
  };
}

export async function markInviteUsed(
  client: PoolClient,
  inviteId: string,
  principalId: string,
): Promise<void> {
  await client.query(`UPDATE invites SET used_by = $1, used_at = now() WHERE id = $2`, [
    principalId,
    inviteId,
  ]);
}
