import { createHmac } from "node:crypto";

export function hashEmail(email: string, hmacKey: string): string {
  const normalized = email.toLowerCase().trim();
  return createHmac("sha256", hmacKey).update(normalized).digest("hex");
}
