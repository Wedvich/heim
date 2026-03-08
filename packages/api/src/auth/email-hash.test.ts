import { describe, expect, it } from "vitest";
import { hashEmail } from "./email-hash.ts";

describe("hashEmail", () => {
  const key = "test-hmac-key";

  it("returns a 64-char hex string", () => {
    const hash = hashEmail("user@example.com", key);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    const a = hashEmail("user@example.com", key);
    const b = hashEmail("user@example.com", key);
    expect(a).toBe(b);
  });

  it("normalizes case", () => {
    const lower = hashEmail("user@example.com", key);
    const upper = hashEmail("USER@EXAMPLE.COM", key);
    expect(lower).toBe(upper);
  });

  it("trims whitespace", () => {
    const trimmed = hashEmail("user@example.com", key);
    const padded = hashEmail("  user@example.com  ", key);
    expect(trimmed).toBe(padded);
  });

  it("produces different hashes for different keys", () => {
    const a = hashEmail("user@example.com", "key-a");
    const b = hashEmail("user@example.com", "key-b");
    expect(a).not.toBe(b);
  });
});
