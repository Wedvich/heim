import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MlKemKeyManagementService } from "./mlkem-kms.ts";

function createTestKms(mekVersion = 2) {
  const { publicKey, privateKey } = generateKeyPairSync("ml-kem-768");
  return new MlKemKeyManagementService(publicKey, privateKey, mekVersion);
}

describe("MlKemKeyManagementService", () => {
  it("generates and decrypts a DEK round-trip", async () => {
    const kms = createTestKms();
    const { plaintextDek, encryptedDek, mekVersion } = await kms.generateDek();

    expect(plaintextDek).toHaveLength(32);
    expect(encryptedDek.length).toBeGreaterThan(1088);
    expect(mekVersion).toBe(2);

    const decrypted = await kms.decryptDek(encryptedDek, mekVersion);
    expect(decrypted).toEqual(plaintextDek);
  });

  it("fails to decrypt tampered KEM ciphertext", async () => {
    const kms = createTestKms();
    const { encryptedDek, mekVersion } = await kms.generateDek();

    encryptedDek[0]! ^= 0xff;

    await expect(kms.decryptDek(encryptedDek, mekVersion)).rejects.toThrow();
  });

  it("fails to decrypt tampered wrapped DEK", async () => {
    const kms = createTestKms();
    const { encryptedDek, mekVersion } = await kms.generateDek();

    encryptedDek[encryptedDek.length - 1]! ^= 0xff;

    await expect(kms.decryptDek(encryptedDek, mekVersion)).rejects.toThrow();
  });

  it("rejects unsupported mek version", async () => {
    const kms = createTestKms();
    const { encryptedDek } = await kms.generateDek();

    await expect(kms.decryptDek(encryptedDek, 99)).rejects.toThrow("Unsupported MEK version: 99");
  });

  it("generates unique DEKs on each call", async () => {
    const kms = createTestKms();
    const a = await kms.generateDek();
    const b = await kms.generateDek();

    expect(a.plaintextDek).not.toEqual(b.plaintextDek);
    expect(a.encryptedDek).not.toEqual(b.encryptedDek);
  });

  it("cannot decrypt with a different key pair", async () => {
    const kms1 = createTestKms();
    const kms2 = createTestKms();

    const { encryptedDek, mekVersion } = await kms1.generateDek();

    await expect(kms2.decryptDek(encryptedDek, mekVersion)).rejects.toThrow();
  });

  it("creates from base64 DER strings", async () => {
    const { publicKey, privateKey } = generateKeyPairSync("ml-kem-768");
    const pkBase64 = (publicKey.export({ type: "spki", format: "der" }) as Buffer).toString("base64");
    const skBase64 = (privateKey.export({ type: "pkcs8", format: "der" }) as Buffer).toString(
      "base64",
    );

    const kms = MlKemKeyManagementService.fromBase64(pkBase64, skBase64);
    const { plaintextDek, encryptedDek, mekVersion } = await kms.generateDek();
    const decrypted = await kms.decryptDek(encryptedDek, mekVersion);
    expect(decrypted).toEqual(plaintextDek);
  });
});
