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

export async function postLogout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" });
}
