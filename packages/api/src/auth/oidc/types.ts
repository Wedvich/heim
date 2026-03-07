export interface VerifiedIdentity {
  readonly provider: string;
  readonly providerSubjectId: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name?: string;
  readonly avatarUrl?: string;
}

export interface OidcProviderVerifier {
  readonly providerId: string;
  verify(credential: string): Promise<VerifiedIdentity>;
}

export class TokenVerificationError extends Error {
  readonly provider: string;
  override readonly cause?: unknown;

  constructor(provider: string, message: string, cause?: unknown) {
    super(message);
    this.name = "TokenVerificationError";
    this.provider = provider;
    this.cause = cause;
  }
}

export class UnknownProviderError extends Error {
  readonly provider: string;

  constructor(provider: string) {
    super(`No verifier registered for provider: ${provider}`);
    this.name = "UnknownProviderError";
    this.provider = provider;
  }
}
