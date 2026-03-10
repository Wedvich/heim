import { generateTraceId, CORRELATION_HEADER } from "@heim/logging";

/**
 * Thin wrapper around `fetch` that attaches a correlation ID to every request.
 * The ID is a W3C-compatible trace-id (32 hex chars) generated fresh per call.
 */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has(CORRELATION_HEADER)) {
    headers.set(CORRELATION_HEADER, generateTraceId());
  }
  return fetch(input, { ...init, headers });
}
