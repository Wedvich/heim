import {
  type KeyObject,
  createPublicKey,
  createPrivateKey,
  encapsulate,
  decapsulate,
  randomBytes,
} from "node:crypto";
import { encryptPayload, decryptPayload } from "./payload-encryption.ts";
import type { GeneratedDek, KeyManagementService } from "./kms.ts";

const KEM_CIPHERTEXT_LENGTH = 1088;
const DEK_LENGTH = 32;

export class MlKemKeyManagementService implements KeyManagementService {
  readonly #publicKey: KeyObject;
  readonly #privateKey: KeyObject;
  readonly #mekVersion: number;

  constructor(publicKey: KeyObject, privateKey: KeyObject, mekVersion = 2) {
    this.#publicKey = publicKey;
    this.#privateKey = privateKey;
    this.#mekVersion = mekVersion;
  }

  static fromBase64(publicKeyBase64: string, privateKeyBase64: string, mekVersion = 2) {
    const publicKey = createPublicKey({
      key: Buffer.from(publicKeyBase64, "base64"),
      format: "der",
      type: "spki",
    });
    const privateKey = createPrivateKey({
      key: Buffer.from(privateKeyBase64, "base64"),
      format: "der",
      type: "pkcs8",
    });
    return new MlKemKeyManagementService(publicKey, privateKey, mekVersion);
  }

  async generateDek(): Promise<GeneratedDek> {
    const { ciphertext, sharedSecret } = encapsulate(this.#publicKey);
    const plaintextDek = randomBytes(DEK_LENGTH);
    const wrappedDek = encryptPayload(plaintextDek, sharedSecret);
    const encryptedDek = Buffer.concat([ciphertext, wrappedDek]);
    return { plaintextDek, encryptedDek, mekVersion: this.#mekVersion };
  }

  async decryptDek(encryptedDek: Buffer, mekVersion: number): Promise<Buffer> {
    if (mekVersion !== this.#mekVersion) {
      throw new Error(`Unsupported MEK version: ${mekVersion}`);
    }
    const kemCiphertext = encryptedDek.subarray(0, KEM_CIPHERTEXT_LENGTH);
    const wrappedDek = encryptedDek.subarray(KEM_CIPHERTEXT_LENGTH);
    const { sharedSecret } = decapsulate(this.#privateKey, kemCiphertext);
    return decryptPayload(wrappedDek, sharedSecret);
  }
}
