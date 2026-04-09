import { type KeyObject, decapsulate, encapsulate, randomBytes } from "node:crypto";
import { decryptPayload, encryptPayload } from "./payload-encryption.ts";

const KEM_CIPHERTEXT_LENGTH = 1088;
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
  readonly #publicKey: KeyObject;
  readonly #privateKey: KeyObject;
  readonly #mekVersion = 1;

  constructor(publicKey: KeyObject, privateKey: KeyObject) {
    this.#publicKey = publicKey;
    this.#privateKey = privateKey;
  }

  async generateDek(): Promise<GeneratedDek> {
    const plaintextDek = randomBytes(DEK_LENGTH);
    const { sharedKey, ciphertext } = encapsulate(this.#publicKey);
    const wrappedDek = encryptPayload(plaintextDek, sharedKey);
    const encryptedDek = Buffer.concat([ciphertext, wrappedDek]);
    return { plaintextDek, encryptedDek, mekVersion: this.#mekVersion };
  }

  async decryptDek(encryptedDek: Buffer, mekVersion: number): Promise<Buffer> {
    if (mekVersion !== this.#mekVersion) {
      throw new Error(`Unsupported MEK version: ${mekVersion}`);
    }
    const kemCiphertext = encryptedDek.subarray(0, KEM_CIPHERTEXT_LENGTH);
    const wrappedDek = encryptedDek.subarray(KEM_CIPHERTEXT_LENGTH);
    const sharedKey = decapsulate(this.#privateKey, kemCiphertext);
    return decryptPayload(wrappedDek, sharedKey);
  }
}
