import { OAuth2Client } from "google-auth-library";
import type { OidcProviderVerifier, VerifiedIdentity } from "./types.ts";
import { TokenVerificationError } from "./types.ts";

interface GoogleVerifierConfig {
  clientIds: string[];
}

export class GoogleOidcVerifier implements OidcProviderVerifier {
  readonly providerId = "google";
  readonly #client: OAuth2Client;
  readonly #clientIds: string[];

  constructor(config: GoogleVerifierConfig) {
    this.#clientIds = config.clientIds;
    this.#client = new OAuth2Client();
  }

  async verify(credential: string): Promise<VerifiedIdentity> {
    let ticket;
    try {
      ticket = await this.#client.verifyIdToken({
        idToken: credential,
        audience: this.#clientIds,
      });
    } catch (cause) {
      throw new TokenVerificationError(this.providerId, "Token verification failed", cause);
    }

    const payload = ticket.getPayload();
    if (!payload?.sub) {
      throw new TokenVerificationError(this.providerId, "Token payload missing sub claim");
    }
    if (!payload.email) {
      throw new TokenVerificationError(this.providerId, "Token payload missing email claim");
    }

    return {
      provider: this.providerId,
      providerSubjectId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified ?? false,
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.picture !== undefined && { avatarUrl: payload.picture }),
    };
  }
}
