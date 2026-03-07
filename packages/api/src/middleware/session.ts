import type { CookieOptions, RequestHandler } from "express";
import { pool } from "../db.ts";
import type { SessionContext } from "../session-context.ts";

export const COOKIE_NAME = "heim_sid";

export function cookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  };
}

function parseCookie(header: string, name: string): string | undefined {
  for (const part of header.split(";")) {
    const [key, ...rest] = part.split("=");
    if (key?.trim() === name) return rest.join("=").trim();
  }
  return undefined;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  session: SessionContext;
  cachedAt: number;
}

export const sessionCache = new Map<string, CacheEntry>();

export async function invalidateSession(sessionId: string): Promise<void> {
  sessionCache.delete(sessionId);
  await pool.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
}

export const sessionMiddleware: RequestHandler = async (req, res, next) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) {
    next();
    return;
  }

  const sid = parseCookie(cookieHeader, COOKIE_NAME);
  if (!sid) {
    next();
    return;
  }

  // Check cache
  const cached = sessionCache.get(sid);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    if (cached.session.expiresAt > new Date()) {
      req.session = cached.session;
      next();
      return;
    }
    // Expired — clear cache entry and cookie
    sessionCache.delete(sid);
    res.clearCookie(COOKIE_NAME, cookieOptions());
    next();
    return;
  }

  // Query DB
  const result = await pool.query<{
    id: string;
    principal_id: string;
    tenant_id: string;
    expires_at: Date;
  }>(
    `SELECT s.id, s.principal_id, s.tenant_id, s.expires_at
     FROM sessions s JOIN principals p ON p.id = s.principal_id
     WHERE s.id = $1 AND s.expires_at > now() AND p.status = 'active'`,
    [sid],
  );

  const row = result.rows[0];
  if (!row) {
    sessionCache.delete(sid);
    res.clearCookie(COOKIE_NAME, cookieOptions());
    next();
    return;
  }

  const session: SessionContext = {
    sessionId: row.id,
    principalId: row.principal_id,
    tenantId: row.tenant_id,
    expiresAt: row.expires_at,
  };

  sessionCache.set(sid, { session, cachedAt: Date.now() });
  req.session = session;
  next();
};
