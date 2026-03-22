import { apiFetch } from "../api/fetch.ts";

export interface Session {
  principal: { id: string; type: string };
  tenant: { id: string; name: string; slug: string } | null;
  membership: { role: string } | null;
  expiresAt: string;
}

export async function fetchSession(): Promise<Session | null> {
  const res = await apiFetch("/api/auth/session");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`session fetch failed: ${res.status}`);
  return res.json() as Promise<Session>;
}

export interface InviteStatus {
  valid: boolean;
  type: "join" | "create";
  tenantName: string | null;
}

export async function fetchInviteStatus(token: string): Promise<InviteStatus> {
  const res = await apiFetch(`/api/auth/invite-status?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(`invite status check failed: ${res.status}`);
  return res.json() as Promise<InviteStatus>;
}

export interface SlugCheckResult {
  available: boolean;
  valid: boolean;
  reason?: string;
}

export async function checkSlugAvailable(
  slug: string,
  inviteToken: string,
): Promise<SlugCheckResult> {
  const res = await apiFetch(`/api/tenants/slug-available?slug=${encodeURIComponent(slug)}`, {
    headers: { Authorization: `Bearer ${inviteToken}` },
  });
  if (!res.ok) throw new Error(`slug check failed: ${res.status}`);
  return res.json() as Promise<SlugCheckResult>;
}

export interface RegistrationResult {
  principal?: { id: string };
  tenant?: { id: string };
  error?: string;
}

export async function completeRegistration(
  tenantName: string,
  tenantSlug: string,
): Promise<RegistrationResult> {
  const res = await apiFetch("/api/auth/register/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantName, tenantSlug }),
  });
  return res.json() as Promise<RegistrationResult>;
}

export interface RegistrationContext {
  suggestedTenantName: string | null;
}

export async function fetchRegistrationContext(): Promise<RegistrationContext> {
  const res = await apiFetch("/api/auth/register/context");
  if (!res.ok) return { suggestedTenantName: null };
  return res.json() as Promise<RegistrationContext>;
}

export async function postLogout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" });
}
