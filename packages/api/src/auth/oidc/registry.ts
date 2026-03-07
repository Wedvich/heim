import type { OidcProviderVerifier, VerifiedIdentity } from "./types.ts";
import { UnknownProviderError } from "./types.ts";

export class OidcVerifierRegistry {
  readonly #verifiers = new Map<string, OidcProviderVerifier>();

  register(verifier: OidcProviderVerifier): this {
    if (this.#verifiers.has(verifier.providerId)) {
      throw new Error(`Verifier already registered for provider: ${verifier.providerId}`);
    }
    this.#verifiers.set(verifier.providerId, verifier);
    return this;
  }

  verify(provider: string, credential: string): Promise<VerifiedIdentity> {
    const verifier = this.#verifiers.get(provider);
    if (!verifier) {
      throw new UnknownProviderError(provider);
    }
    return verifier.verify(credential);
  }

  get registeredProviders(): string[] {
    return [...this.#verifiers.keys()];
  }
}
