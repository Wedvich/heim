import type { Pool } from "pg";
import { logger } from "../logger.ts";

export const SYSTEM_PRINCIPAL_ID = "00000000-0000-0000-0000-000000000001";

// Typed allow-list for the `detail` field — prevents PII leaks at the type level.
// IP addresses are NOT included here until scrubbing infrastructure is in place.
export interface AuditDetail {
  correlation_id?: string;
  user_agent?: string;
  provider?: string;
  reason?: string;
}

export type AuditAction =
  | "auth.login.success"
  | "auth.login.failure"
  | "auth.logout"
  | "auth.register.success"
  | "auth.register.failure"
  | "auth.invite.redeemed"
  | "auth.provider.linked";

export interface AuditLogEntry {
  principalId: string;
  tenantId?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  detail?: AuditDetail;
}

const auditLogger = logger.child({ component: "audit" });

// Fire-and-forget — audit failures must never block or fail user-facing requests.
export function writeAuditLog(db: Pool, entry: AuditLogEntry): void {
  auditLogger.info({ audit: entry }, entry.action);
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
    auditLogger.error({ err, entry }, "Audit log write failed");
  });
}
