import type { RequestHandler } from "express";
import type { Pool } from "pg";

export type LightAuthContext =
  | { type: "session"; principalId: string; tenantId: string }
  | { type: "invite"; inviteId: string; tenantId: string | null };

declare global {
  namespace Express {
    interface Request {
      lightAuth?: LightAuthContext;
    }
  }
}

export function lightAuthMiddleware(db: Pool): RequestHandler {
  return async (req, res, next) => {
    // Session cookie takes priority
    if (req.session) {
      req.lightAuth = {
        type: "session",
        principalId: req.session.principalId,
        tenantId: req.session.tenantId,
      };
      next();
      return;
    }

    // Fall back to invite token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const result = await db.query<{
        id: string;
        tenant_id: string | null;
      }>(
        `SELECT id, tenant_id FROM invites
         WHERE token = $1 AND used_at IS NULL AND expires_at > now()`,
        [token],
      );
      const row = result.rows[0];
      if (row) {
        req.lightAuth = {
          type: "invite",
          inviteId: row.id,
          tenantId: row.tenant_id,
        };
        next();
        return;
      }
    }

    res.status(401).json({ error: "not_authenticated" });
  };
}
