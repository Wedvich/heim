import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const DEK_LENGTH = 32;

export interface GeneratedDek {
  readonly plaintextDek: Buffer;
  readonly encryptedDek: Buffer;
  readonly mekVersion: number;
}

export interface KeyManagementService {
  generateDek(): Promise<GeneratedDek>;
  decryptDek(encryptedDek: Buffer, mekVersion: number): Promise<Buffer>;
}

export class LocalKeyManagementService implements KeyManagementService {
  private readonly mek: Buffer;
  private readonly mekVersion = 1;

  constructor(mekBase64: string) {
    this.mek = Buffer.from(mekBase64, "base64");
    if (this.mek.length !== 32) {
      throw new Error("MASTER_ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
    }
  }

  async generateDek(): Promise<GeneratedDek> {
    const plaintextDek = randomBytes(DEK_LENGTH);
    const encryptedDek = this.encrypt(plaintextDek);
    return { plaintextDek, encryptedDek, mekVersion: this.mekVersion };
  }

  async decryptDek(encryptedDek: Buffer, mekVersion: number): Promise<Buffer> {
    if (mekVersion !== this.mekVersion) {
      throw new Error(`Unsupported MEK version: ${mekVersion}`);
    }
    return this.decrypt(encryptedDek);
  }

  private encrypt(plaintext: Buffer): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.mek, iv, { authTagLength: AUTH_TAG_LENGTH });
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]);
  }

  private decrypt(encrypted: Buffer): Buffer {
    const iv = encrypted.subarray(0, IV_LENGTH);
    const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = encrypted.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, this.mek, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}
