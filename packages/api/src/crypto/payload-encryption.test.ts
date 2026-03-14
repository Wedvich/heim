import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptPayload, encryptPayload } from "./payload-encryption.ts";

const dek = randomBytes(32);

describe("payload encryption", () => {
  it("encrypts and decrypts a round-trip", () => {
    const plaintext = Buffer.from(JSON.stringify({ email: "test@example.com" }));
    const encrypted = encryptPayload(plaintext, dek);
    const decrypted = decryptPayload(encrypted, dek);
    expect(decrypted).toEqual(plaintext);
  });

  it("produces different ciphertext for same plaintext (random IV)", () => {
    const plaintext = Buffer.from("hello");
    const a = encryptPayload(plaintext, dek);
    const b = encryptPayload(plaintext, dek);
    expect(a).not.toEqual(b);
  });

  it("fails to decrypt with wrong key", () => {
    const plaintext = Buffer.from("secret");
    const encrypted = encryptPayload(plaintext, dek);
    const wrongKey = randomBytes(32);
    expect(() => decryptPayload(encrypted, wrongKey)).toThrow();
  });

  it("fails to decrypt tampered ciphertext", () => {
    const plaintext = Buffer.from("secret");
    const encrypted = encryptPayload(plaintext, dek);
    encrypted[encrypted.length - 1]! ^= 0xff;
    expect(() => decryptPayload(encrypted, dek)).toThrow();
  });
});
