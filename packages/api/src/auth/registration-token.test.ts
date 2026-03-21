import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  sealRegistrationToken,
  openRegistrationToken,
  type RegistrationTokenPayload,
} from "./registration-token.ts";

const secret = randomBytes(32);

const payload: RegistrationTokenPayload = {
  provider: "google",
  providerSubjectId: "112233445566",
  email: "alice@example.com",
  emailVerified: true,
  name: "Alice",
  avatarUrl: "https://example.com/avatar.jpg",
  inviteToken: "inv_abc123",
  issuedAt: Date.now(),
};

describe("registration-token", () => {
  it("round-trips seal → open", () => {
    const token = sealRegistrationToken(payload, secret);
    const result = openRegistrationToken(token, secret, 15 * 60 * 1000);

    expect(result).toEqual(payload);
  });

  it("returns null for expired token", () => {
    const expired: RegistrationTokenPayload = {
      ...payload,
      issuedAt: Date.now() - 20 * 60 * 1000, // 20 minutes ago
    };
    const token = sealRegistrationToken(expired, secret);
    const result = openRegistrationToken(token, secret, 15 * 60 * 1000);

    expect(result).toBeNull();
  });

  it("returns null for tampered ciphertext", () => {
    const token = sealRegistrationToken(payload, secret);
    const raw = Buffer.from(token, "base64url");
    raw[raw.length - 1]! ^= 0xff;
    const tampered = raw.toString("base64url");

    expect(openRegistrationToken(tampered, secret, 15 * 60 * 1000)).toBeNull();
  });

  it("returns null for wrong key", () => {
    const token = sealRegistrationToken(payload, secret);
    const wrongKey = randomBytes(32);

    expect(openRegistrationToken(token, wrongKey, 15 * 60 * 1000)).toBeNull();
  });

  it("returns null for invalid base64", () => {
    expect(openRegistrationToken("not-valid!!!", secret, 15 * 60 * 1000)).toBeNull();
  });

  it("returns null for truncated token", () => {
    const token = sealRegistrationToken(payload, secret);
    const truncated = token.slice(0, 10);

    expect(openRegistrationToken(truncated, secret, 15 * 60 * 1000)).toBeNull();
  });

  it("produces different ciphertext each time (random IV)", () => {
    const a = sealRegistrationToken(payload, secret);
    const b = sealRegistrationToken(payload, secret);

    expect(a).not.toBe(b);
  });

  it("handles payload without optional fields", () => {
    const minimal: RegistrationTokenPayload = {
      provider: "google",
      providerSubjectId: "998877",
      email: "bob@example.com",
      emailVerified: false,
      inviteToken: "inv_xyz",
      issuedAt: Date.now(),
    };
    const token = sealRegistrationToken(minimal, secret);
    const result = openRegistrationToken(token, secret, 15 * 60 * 1000);

    expect(result).toEqual(minimal);
  });
});
