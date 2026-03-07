import { randomBytes } from "node:crypto";
import type { Pool } from "pg";

const SESSION_TTL_DAYS = 30;

export async function createSession(
  db: Pool,
  principalId: string,
  tenantId: string,
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO sessions (id, principal_id, tenant_id, expires_at) VALUES ($1, $2, $3, $4)`,
    [token, principalId, tenantId, expiresAt],
  );

  return token;
}
