import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export interface RegistrationTokenPayload {
  readonly provider: string;
  readonly providerSubjectId: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name?: string;
  readonly familyName?: string;
  readonly avatarUrl?: string;
  readonly inviteToken: string;
  readonly issuedAt: number;
}

export function sealRegistrationToken(payload: RegistrationTokenPayload, secret: Buffer): string {
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, secret, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
}

export function openRegistrationToken(
  token: string,
  secret: Buffer,
  maxAgeMs: number,
): RegistrationTokenPayload | null {
  try {
    const raw = Buffer.from(token, "base64url");
    if (raw.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) return null;

    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, secret, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    const payload = JSON.parse(plaintext.toString("utf8")) as RegistrationTokenPayload;

    if (typeof payload.issuedAt !== "number") return null;
    if (Date.now() - payload.issuedAt > maxAgeMs) return null;

    return payload;
  } catch {
    return null;
  }
}
