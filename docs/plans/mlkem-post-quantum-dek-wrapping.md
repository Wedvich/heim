# Plan: Add ML-KEM Post-Quantum Key Encapsulation for DEK Wrapping

## Context

The forgettable payloads system uses a 2-tier MEK→DEK envelope encryption with
AES-256-GCM throughout. AES-256 is already post-quantum safe for symmetric
operations. However, the project's docs specify that the MEK should live in a
KMS in production — adding ML-KEM enables true **privilege separation**: the
registration service (which creates DEKs) only needs the ML-KEM public key and
**cannot** decrypt existing DEKs, while decryption requires the secret key
(held by KMS/HSM). This also future-proofs the key exchange layer with NIST
FIPS 203 post-quantum cryptography.

**Important correction:** The codebase does NOT use RSA — it's 100% symmetric
AES-256-GCM. ML-KEM adds an asymmetric encapsulation layer on top.

## Approach: ML-KEM Hybrid DEK Wrapping

For each new DEK:
1. `encap(publicKey)` → `(kemCiphertext, sharedSecret)` — 1088-byte CT, 32-byte SS
2. AES-256-GCM wrap the random 32-byte DEK using `sharedSecret` as key
3. Store `kemCiphertext || wrappedDEK` in `encrypted_key` column (~1148 bytes)

For DEK recovery:
1. Parse first 1088 bytes as `kemCiphertext`, remainder as AES-wrapped DEK
2. `decap(secretKey, kemCiphertext)` → `sharedSecret`
3. AES-256-GCM unwrap DEK using `sharedSecret`

**Why hybrid (KEM + AES wrap) instead of direct KEM→DEK derivation:** Key
rotation only re-wraps DEKs (cheap). Direct derivation would change every DEK
on rotation, requiring re-encryption of all payloads (expensive).

## What Does NOT Need Changing

- **DEK→Payload encryption** (`payload-encryption.ts`): AES-256-GCM, already PQ-safe
- **Registration token** (`registration-token.ts`): AES-256-GCM, ephemeral 15-min TTL, server-side only
- **Email HMAC** (`email-hash.ts`): HMAC-SHA256, already PQ-safe
- **Database schema**: `encrypted_key` is `bytea` (variable length), `mek_version` already exists — v2 rows just have larger blobs

## Implementation Steps

### 1. No new dependencies

Node.js 25 (per `.nvmrc`) has native ML-KEM support in `node:crypto` via
OpenSSL 3.5.x. No npm package needed. The API:

```ts
import { generateKeyPairSync, encapsulate, decapsulate } from "node:crypto";

// Key generation (one-time, for operators)
const { publicKey, privateKey } = generateKeyPairSync("ml-kem-768");

// Encapsulate (only needs public key — registration service)
const { ciphertext, sharedSecret } = encapsulate(publicKey);
// ciphertext: Buffer (1088 bytes), sharedSecret: Buffer (32 bytes)

// Decapsulate (needs private key — decryption service)
const { sharedSecret } = decapsulate(privateKey, ciphertext);
```

Keys are `KeyObject` instances. For env var storage, export as DER + base64:

```ts
publicKey.export({ type: "spki", format: "der" });   // → Buffer
privateKey.export({ type: "pkcs8", format: "der" });  // → Buffer
```

And reconstruct via `createPublicKey` / `createPrivateKey`:

```ts
import { createPublicKey, createPrivateKey } from "node:crypto";
const pk = createPublicKey({ key: Buffer.from(env, "base64"), format: "der", type: "spki" });
const sk = createPrivateKey({ key: Buffer.from(env, "base64"), format: "der", type: "pkcs8" });
```

### 2. New file: `packages/api/src/crypto/mlkem-kms.ts`

New `MlKemKeyManagementService` implementing the existing `KeyManagementService`
interface:

- Constructor: takes ML-KEM-768 private key + public key as `KeyObject` (loaded
  from base64 DER env vars)
- `generateDek()`:
  - `crypto.encapsulate(publicKey)` → `{ ciphertext, sharedSecret }`
  - Generate random 32-byte DEK
  - AES-256-GCM wrap DEK with `sharedSecret`
  - Return `{ plaintextDek, encryptedDek: Buffer.concat([ciphertext, wrappedDEK]), mekVersion: 2 }`
- `decryptDek(encryptedDek, mekVersion)`:
  - Split: `kemCT = encryptedDek.subarray(0, 1088)`, `wrappedDEK = encryptedDek.subarray(1088)`
  - `crypto.decapsulate(privateKey, kemCT)` → `{ sharedSecret }`
  - AES-256-GCM unwrap DEK with `sharedSecret`
  - Return plaintext DEK

Uses `encryptPayload`/`decryptPayload` from `payload-encryption.ts` for the AES
wrapping layer (reuse existing code — it's the same AES-256-GCM operation).

### 3. Modify `packages/api/src/crypto/kms.ts` — Add hybrid routing

Add a `HybridKeyManagementService` that wraps both implementations:

```ts
export class HybridKeyManagementService implements KeyManagementService {
  constructor(
    private readonly legacy: LocalKeyManagementService,
    private readonly mlkem: MlKemKeyManagementService,
  ) {}

  generateDek() { return this.mlkem.generateDek(); }  // Always use ML-KEM

  decryptDek(encryptedDek: Buffer, mekVersion: number) {
    if (mekVersion === 1) return this.legacy.decryptDek(encryptedDek, mekVersion);
    return this.mlkem.decryptDek(encryptedDek, mekVersion);
  }
}
```

### 4. Modify `packages/api/src/index.ts` — New env vars

```ts
import { createPublicKey, createPrivateKey } from "node:crypto";

const mlkemPublicKey = createPublicKey({
  key: Buffer.from(requireEnv("MLKEM_PUBLIC_KEY"), "base64"),
  format: "der", type: "spki",
});
const mlkemPrivateKey = createPrivateKey({
  key: Buffer.from(requireEnv("MLKEM_SECRET_KEY"), "base64"),
  format: "der", type: "pkcs8",
});

const legacyKms = new LocalKeyManagementService(masterEncryptionKey);
const mlkemKms = new MlKemKeyManagementService(mlkemPrivateKey, mlkemPublicKey);
const kms = new HybridKeyManagementService(legacyKms, mlkemKms);
```

Keep `MASTER_ENCRYPTION_KEY` for backward compat with existing v1 DEKs.

### 5. Add key generation utility

Add a script or CLI command to generate ML-KEM-768 key pairs for operators:

```ts
// packages/api/src/crypto/generate-mlkem-keypair.ts
import { generateKeyPairSync } from "node:crypto";
const { publicKey, privateKey } = generateKeyPairSync("ml-kem-768");
const pk = publicKey.export({ type: "spki", format: "der" });
const sk = privateKey.export({ type: "pkcs8", format: "der" });
console.log("MLKEM_PUBLIC_KEY=" + pk.toString("base64"));
console.log("MLKEM_SECRET_KEY=" + sk.toString("base64"));
```

### 6. Update Docker Compose dev environment

In `packages/infra/compose.yml`, add generated ML-KEM keys to the API service
environment (dev-only values, like the existing `MASTER_ENCRYPTION_KEY`).

### 7. Update tests

**`packages/api/src/crypto/mlkem-kms.test.ts`** (new):
- ML-KEM round-trip: generate DEK → decrypt DEK → matches
- Tampered ciphertext detection
- Unique DEKs per call
- Wrong secret key rejection

**`packages/api/src/crypto/kms.test.ts`** (extend):
- Add tests for `HybridKeyManagementService`
- v1 DEK decrypted via legacy path
- v2 DEK decrypted via ML-KEM path
- New DEKs always have `mekVersion: 2`

**Existing integration tests** (`register-handler.test.ts`,
`load-tenant-events.test.ts`, `sync.test.ts`) should pass unchanged — they
use the `KeyManagementService` interface, which is preserved.

### 8. Update docs

- `docs/database.md`: Add ML-KEM to required secrets table, document v2 format
- `docs/security.md`: Update A04 section with ML-KEM details

## Files to Modify

| File | Change |
|------|--------|
| `packages/api/src/crypto/mlkem-kms.ts` | **New** — ML-KEM KMS implementation (native `node:crypto`) |
| `packages/api/src/crypto/mlkem-kms.test.ts` | **New** — ML-KEM KMS tests |
| `packages/api/src/crypto/generate-mlkem-keypair.ts` | **New** — Key generation utility |
| `packages/api/src/crypto/kms.ts` | Add `HybridKeyManagementService` |
| `packages/api/src/crypto/kms.test.ts` | Add hybrid routing tests |
| `packages/api/src/index.ts` | Wire up ML-KEM env vars + hybrid KMS |
| `packages/infra/compose.yml` | Add dev ML-KEM keys |
| `docs/database.md` | Document ML-KEM key format + new env vars |
| `docs/security.md` | Update crypto posture |

## Reusable Existing Code

- `encryptPayload`/`decryptPayload` from `packages/api/src/crypto/payload-encryption.ts` — reuse for AES-256-GCM wrapping of DEK with the KEM shared secret
- `KeyManagementService` interface from `packages/api/src/crypto/kms.ts` — no change, both implementations conform
- `forgettable-payload-key-repository.ts` — no change, stores opaque `bytea`
- `mek_version` column — already supports routing to different decryption paths

## Migration Path

1. **Deploy** with both `MASTER_ENCRYPTION_KEY` (v1) and `MLKEM_*` keys (v2)
2. **New DEKs** automatically use ML-KEM (mek_version=2)
3. **Existing v1 DEKs** continue to decrypt via legacy AES path
4. **Optional re-wrap**: background job decrypts v1 DEKs with old MEK, re-wraps with ML-KEM as v2

## Verification

1. `yarn turbo test -F @heim/api` — all existing + new tests pass
2. `yarn turbo typecheck` — no type errors
3. `yarn turbo lint` — clean
4. Manual: start dev (`yarn turbo dev`), register a user → verify forgettable payload created with mek_version=2, verify sync endpoint returns decrypted PII
