import type { Pool } from "pg";

export const SYSTEM_PRINCIPAL_ID = "00000000-0000-0000-0000-000000000001";

// Typed allow-list for the `detail` field — prevents PII leaks at the type level.
// IP addresses are NOT included here until scrubbing infrastructure is in place.
export interface AuditDetail {
  user_agent?: string;
  provider?: string;
  reason?: string;
}

export interface AuditLogEntry {
  principalId: string;
  tenantId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  detail?: AuditDetail;
}

// Fire-and-forget — audit failures must never block or fail user-facing requests.
export function writeAuditLog(db: Pool, entry: AuditLogEntry): void {
  db.query(
    `INSERT INTO audit_log (principal_id, tenant_id, action, resource_type, resource_id, detail)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      entry.principalId,
      entry.tenantId ?? null,
      entry.action,
      entry.resourceType ?? null,
      entry.resourceId ?? null,
      entry.detail ? JSON.stringify(entry.detail) : "{}",
    ],
  ).catch((err: unknown) => {
    console.error("Audit log write failed", err, { entry });
  });
}
