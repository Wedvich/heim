import { generateKeyPairSync, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LocalKeyManagementService, HybridKeyManagementService } from "./kms.ts";
import { MlKemKeyManagementService } from "./mlkem-kms.ts";

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

describe("HybridKeyManagementService", () => {
  function createHybrid() {
    const legacy = new LocalKeyManagementService(validMek);
    const { publicKey, privateKey } = generateKeyPairSync("ml-kem-768");
    const mlkem = new MlKemKeyManagementService(publicKey, privateKey);
    return { hybrid: new HybridKeyManagementService(legacy, mlkem), legacy, mlkem };
  }

  it("generates new DEKs via ML-KEM (mekVersion 2)", async () => {
    const { hybrid } = createHybrid();
    const { plaintextDek, encryptedDek, mekVersion } = await hybrid.generateDek();

    expect(mekVersion).toBe(2);
    expect(plaintextDek).toHaveLength(32);
    expect(encryptedDek.length).toBeGreaterThan(1088);

    const decrypted = await hybrid.decryptDek(encryptedDek, mekVersion);
    expect(decrypted).toEqual(plaintextDek);
  });

  it("decrypts legacy v1 DEKs via AES path", async () => {
    const { hybrid, legacy } = createHybrid();
    const { plaintextDek, encryptedDek, mekVersion } = await legacy.generateDek();
    expect(mekVersion).toBe(1);

    const decrypted = await hybrid.decryptDek(encryptedDek, mekVersion);
    expect(decrypted).toEqual(plaintextDek);
  });

  it("routes v2 to ML-KEM and v1 to legacy without cross-contamination", async () => {
    const { hybrid, legacy } = createHybrid();

    const v1 = await legacy.generateDek();
    const v2 = await hybrid.generateDek();

    const d1 = await hybrid.decryptDek(v1.encryptedDek, v1.mekVersion);
    const d2 = await hybrid.decryptDek(v2.encryptedDek, v2.mekVersion);

    expect(d1).toEqual(v1.plaintextDek);
    expect(d2).toEqual(v2.plaintextDek);
  });
});
