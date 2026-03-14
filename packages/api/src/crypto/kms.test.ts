import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LocalKeyManagementService } from "./kms.ts";

const validMek = randomBytes(32).toString("base64");

describe("LocalKeyManagementService", () => {
  it("rejects MEK that is not 32 bytes", () => {
    expect(() => new LocalKeyManagementService("dG9vc2hvcnQ=")).toThrow(
      "MASTER_ENCRYPTION_KEY must be 32 bytes",
    );
  });

  it("generates and decrypts a DEK round-trip", async () => {
    const kms = new LocalKeyManagementService(validMek);
    const { plaintextDek, encryptedDek, mekVersion } = await kms.generateDek();

    expect(plaintextDek).toHaveLength(32);
    expect(encryptedDek.length).toBeGreaterThan(32);
    expect(mekVersion).toBe(1);

    const decrypted = await kms.decryptDek(encryptedDek, mekVersion);
    expect(decrypted).toEqual(plaintextDek);
  });

  it("fails to decrypt tampered ciphertext", async () => {
    const kms = new LocalKeyManagementService(validMek);
    const { encryptedDek, mekVersion } = await kms.generateDek();

    // Tamper with ciphertext portion (after iv + authTag = 28 bytes)
    encryptedDek[28]! ^= 0xff;

    await expect(kms.decryptDek(encryptedDek, mekVersion)).rejects.toThrow();
  });

  it("rejects unsupported MEK version", async () => {
    const kms = new LocalKeyManagementService(validMek);
    const { encryptedDek } = await kms.generateDek();

    await expect(kms.decryptDek(encryptedDek, 99)).rejects.toThrow("Unsupported MEK version: 99");
  });

  it("generates unique DEKs on each call", async () => {
    const kms = new LocalKeyManagementService(validMek);
    const a = await kms.generateDek();
    const b = await kms.generateDek();

    expect(a.plaintextDek).not.toEqual(b.plaintextDek);
    expect(a.encryptedDek).not.toEqual(b.encryptedDek);
  });
});
