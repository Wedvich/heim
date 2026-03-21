import type { RequestHandler } from "express";
import { pool } from "../db.ts";
import type { TenantContext } from "../session-context.ts";

const CACHE_TTL_MS = 60 * 1000;

interface MembershipCacheEntry {
  tenantId: string;
  role: string;
  cachedAt: number;
}

// Keyed by "principalId:tenantId" for ID-based lookups,
// "principalId:slug:<slug>" for slug-based lookups
const membershipCache = new Map<string, MembershipCacheEntry | null>();

function getCached(key: string): MembershipCacheEntry | null | undefined {
  const entry = membershipCache.get(key);
  if (entry === undefined) return undefined;
  if (entry !== null && Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    membershipCache.delete(key);
    return undefined;
  }
  // Null entries (no membership) also expire
  if (entry === null) {
    // We store null with a timestamp trick — just expire after TTL
    // For simplicity, re-check by not caching negatives
    membershipCache.delete(key);
    return undefined;
  }
  return entry;
}

async function resolveTenantBySlug(
  principalId: string,
  slug: string,
): Promise<TenantContext | null> {
  const slugKey = `${principalId}:slug:${slug}`;
  const cached = getCached(slugKey);
  if (cached !== undefined) return cached;

  const result = await pool.query<{ tenant_id: string; role: string }>(
    `SELECT m.tenant_id, m.role
     FROM memberships m
     JOIN tenants t ON t.id = m.tenant_id
     WHERE m.principal_id = $1 AND t.slug = $2 AND t.status = 'active'`,
    [principalId, slug],
  );

  const row = result.rows[0];
  if (!row) return null;

  const entry: MembershipCacheEntry = {
    tenantId: row.tenant_id,
    role: row.role,
    cachedAt: Date.now(),
  };
  membershipCache.set(slugKey, entry);
  return { tenantId: entry.tenantId, role: entry.role };
}

async function resolveTenantById(
  principalId: string,
  tenantId: string,
): Promise<TenantContext | null> {
  const idKey = `${principalId}:${tenantId}`;
  const cached = getCached(idKey);
  if (cached !== undefined) return cached;

  const result = await pool.query<{ role: string }>(
    `SELECT m.role
     FROM memberships m
     JOIN tenants t ON t.id = m.tenant_id
     WHERE m.principal_id = $1 AND m.tenant_id = $2 AND t.status = 'active'`,
    [principalId, tenantId],
  );

  const row = result.rows[0];
  if (!row) return null;

  const entry: MembershipCacheEntry = {
    tenantId,
    role: row.role,
    cachedAt: Date.now(),
  };
  membershipCache.set(idKey, entry);
  return { tenantId, role: entry.role };
}

export const tenantContextMiddleware: RequestHandler = async (req, res, next) => {
  if (!req.session) {
    next();
    return;
  }

  const slug = req.headers["x-tenant-slug"];
  const { principalId, tenantId: defaultTenantId } = req.session;

  let tenantContext: TenantContext | null;

  if (typeof slug === "string" && slug) {
    tenantContext = await resolveTenantBySlug(principalId, slug);
  } else {
    tenantContext = await resolveTenantById(principalId, defaultTenantId);
  }

  if (!tenantContext) {
    res.status(403).json({ error: "no_membership" });
    return;
  }

  req.tenantContext = tenantContext;
  next();
};
