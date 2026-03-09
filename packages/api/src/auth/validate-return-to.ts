/**
 * Validates a `returnTo` URL to prevent open-redirect attacks.
 * Only allows relative paths starting with `/`. Rejects protocol-relative
 * URLs, absolute URLs, and anything else that could redirect off-site.
 */
export function validateReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}
