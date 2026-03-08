export interface Session {
  principal: { id: string; type: string };
  tenant: { id: string; name: string; slug: string } | null;
  membership: { role: string } | null;
  expiresAt: string;
}

export async function fetchSession(): Promise<Session | null> {
  const res = await fetch("/api/auth/session");
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`session fetch failed: ${res.status}`);
  return res.json() as Promise<Session>;
}

export async function postLogin(credential: string): Promise<Session> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "google", credential }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  return fetchSession().then((s) => {
    if (!s) throw new Error("no session after login");
    return s;
  });
}

export async function postLogout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
