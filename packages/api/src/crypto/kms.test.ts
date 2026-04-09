import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LocalKeyManagementService } from "./kms.ts";

function createKms(): LocalKeyManagementService {
  const { publicKey, privateKey } = generateKeyPairSync("ml-kem-768");
  return new LocalKeyManagementService(publicKey, privateKey);
}

describe("LocalKeyManagementService", () => {
  it("generates and decrypts a DEK round-trip", async () => {
    const kms = createKms();
    const { plaintextDek, encryptedDek, mekVersion } = await kms.generateDek();

    expect(plaintextDek).toHaveLength(32);
    expect(encryptedDek.length).toBeGreaterThan(1088);
    expect(mekVersion).toBe(1);

    const decrypted = await kms.decryptDek(encryptedDek, mekVersion);
    expect(decrypted).toEqual(plaintextDek);
  });

  it("fails to decrypt tampered ciphertext", async () => {
    const kms = createKms();
    const { encryptedDek, mekVersion } = await kms.generateDek();

    // Tamper with the AES-wrapped portion (after 1088-byte KEM ciphertext)
    encryptedDek[1088]! ^= 0xff;

    await expect(kms.decryptDek(encryptedDek, mekVersion)).rejects.toThrow();
  });

  it("rejects unsupported MEK version", async () => {
    const kms = createKms();
    const { encryptedDek } = await kms.generateDek();

    await expect(kms.decryptDek(encryptedDek, 99)).rejects.toThrow("Unsupported MEK version: 99");
  });

  it("generates unique DEKs on each call", async () => {
    const kms = createKms();
    const a = await kms.generateDek();
    const b = await kms.generateDek();

    expect(a.plaintextDek).not.toEqual(b.plaintextDek);
    expect(a.encryptedDek).not.toEqual(b.encryptedDek);
  });

  it("rejects decryption with a different key pair", async () => {
    const kms1 = createKms();
    const kms2 = createKms();
    const { encryptedDek, mekVersion } = await kms1.generateDek();

    await expect(kms2.decryptDek(encryptedDek, mekVersion)).rejects.toThrow();
  });
});
