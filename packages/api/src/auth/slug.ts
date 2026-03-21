import { randomBytes } from "node:crypto";

const SLUG_MIN = 3;
const SLUG_MAX = 48;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "app",
  "auth",
  "billing",
  "callback",
  "dashboard",
  "error",
  "health",
  "help",
  "invite",
  "login",
  "logout",
  "register",
  "settings",
  "status",
  "support",
  "www",
]);

export function validateSlug(slug: string): { valid: boolean; reason?: string } {
  if (slug.length < SLUG_MIN) return { valid: false, reason: "too_short" };
  if (slug.length > SLUG_MAX) return { valid: false, reason: "too_long" };
  if (!SLUG_PATTERN.test(slug)) return { valid: false, reason: "invalid_characters" };
  if (RESERVED_SLUGS.has(slug)) return { valid: false, reason: "reserved" };
  return { valid: true };
}

export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || randomBytes(2).toString("hex");
}

export function generateSlugWithSuffix(name: string): string {
  const base = generateSlug(name);
  const suffix = randomBytes(2).toString("hex");
  return `${base}-${suffix}`;
}
