import type { Pool, PoolClient } from "pg";

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

export async function checkInviteValid(db: Pool, token: string): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM invites WHERE token = $1 AND used_at IS NULL AND expires_at > now()`,
    [token],
  );
  return result.rows.length > 0;
}

export interface InviteInfo {
  valid: boolean;
  tenantId: string | null;
  tenantName: string | null;
  role: string | null;
}

export async function getInviteInfo(db: Pool, token: string): Promise<InviteInfo> {
  const result = await db.query<{
    tenant_id: string | null;
    tenant_name: string | null;
    role: string;
  }>(
    `SELECT i.tenant_id, t.name AS tenant_name, i.role
     FROM invites i
     LEFT JOIN tenants t ON t.id = i.tenant_id
     WHERE i.token = $1 AND i.used_at IS NULL AND i.expires_at > now()`,
    [token],
  );
  const row = result.rows[0];
  if (!row) return { valid: false, tenantId: null, tenantName: null, role: null };
  return {
    valid: true,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    role: row.role,
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
