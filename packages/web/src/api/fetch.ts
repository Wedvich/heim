import { generateTraceId, CORRELATION_HEADER } from "@heim/logging";

let activeTenantSlug: string | undefined;

export function setActiveTenantSlug(slug: string | undefined): void {
  activeTenantSlug = slug;
}

/**
 * Thin wrapper around `fetch` that attaches a correlation ID and tenant slug
 * to every request.
 */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has(CORRELATION_HEADER)) {
    headers.set(CORRELATION_HEADER, generateTraceId());
  }
  if (activeTenantSlug) {
    headers.set("x-tenant-slug", activeTenantSlug);
  }
  return fetch(input, { ...init, headers });
}
