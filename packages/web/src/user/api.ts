import type { HydratedUserEvent } from "@heim/domain";
import { apiFetch } from "../api/fetch";

interface UserEventsResponse {
  events: HydratedUserEvent[];
  version: number;
}

export async function fetchUserEvents(afterVersion?: number): Promise<UserEventsResponse | null> {
  const url =
    afterVersion !== undefined
      ? `/api/user/me/events?afterVersion=${afterVersion}`
      : "/api/user/me/events";

  const res = await apiFetch(url, { credentials: "include" });

  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`Failed to fetch user events: ${res.status}`);

  const data = (await res.json()) as { events: Array<Record<string, unknown>>; version: number };

  const events = data.events.map((e) => ({
    ...e,
    actualTime: new Date(e.actualTime as string),
  })) as HydratedUserEvent[];

  return { events, version: data.version };
}
