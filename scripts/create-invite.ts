// Local dev utility — creates a tenant and invite, then prints a registration URL.
// Usage: node scripts/create-invite.ts

import { randomBytes } from "node:crypto";
import pg from "pg";

const SYSTEM_PRINCIPAL_ID = "00000000-0000-0000-0000-000000000001";
const DATABASE_URL = process.env.DATABASE_URL ?? "postgres://heim:heim@localhost:5432/heim";
const WEB_BASE_URL = process.env.WEB_BASE_URL ?? "http://localhost:5243";

const client = new pg.Client({ connectionString: DATABASE_URL });

try {
  await client.connect();

  // 1. Upsert a dev tenant (idempotent)
  const tenantResult = await client.query<{ id: string }>(
    `INSERT INTO tenants (name, slug)
     VALUES ('Dev Tenant', 'dev-tenant')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
  );
  const tenantId = tenantResult.rows[0]!.id;

  // 2. Create partitions (idempotent)
  const suffix = tenantId.replace(/-/g, "_");
  await client.query(
    `CREATE TABLE IF NOT EXISTS events_${suffix}
     PARTITION OF events FOR VALUES IN ('${tenantId}')`,
  );
  await client.query(
    `CREATE TABLE IF NOT EXISTS forgettable_payloads_${suffix}
     PARTITION OF forgettable_payloads FOR VALUES IN ('${tenantId}')`,
  );

  // 3. Generate invite
  const token = randomBytes(16).toString("base64url");
  await client.query(
    `INSERT INTO invites (token, tenant_id, role, created_by, expires_at)
     VALUES ($1, $2, 'owner', $3, now() + interval '7 days')`,
    [token, tenantId, SYSTEM_PRINCIPAL_ID],
  );

  const url = `${WEB_BASE_URL}/register?invite=${token}`;
  console.log(`\nInvite created for tenant "${tenantResult.rows[0]!.id}"\n`);
  console.log(`  ${url}\n`);
} finally {
  await client.end();
}
