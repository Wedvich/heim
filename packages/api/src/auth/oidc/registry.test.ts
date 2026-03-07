import { describe, expect, it } from "vitest";
import { OidcVerifierRegistry } from "./registry.ts";
import { UnknownProviderError } from "./types.ts";
import type { OidcProviderVerifier, VerifiedIdentity } from "./types.ts";

function makeFakeVerifier(
  providerId: string,
  result?: Partial<VerifiedIdentity>,
): OidcProviderVerifier {
  return {
    providerId,
    verify: async () => ({
      provider: providerId,
      providerSubjectId: "sub-123",
      email: "test@example.com",
      emailVerified: true,
      ...result,
    }),
  };
}

describe("OidcVerifierRegistry", () => {
  it("registers a verifier and routes verify() calls to it", async () => {
    const registry = new OidcVerifierRegistry();
    registry.register(makeFakeVerifier("test-provider"));
    const result = await registry.verify("test-provider", "credential");
    expect(result.provider).toBe("test-provider");
  });

  it("throws UnknownProviderError for an unregistered provider", () => {
    const registry = new OidcVerifierRegistry();
    expect(() => registry.verify("missing", "credential")).toThrow(UnknownProviderError);
  });

  it("throws on duplicate registration", () => {
    const registry = new OidcVerifierRegistry();
    registry.register(makeFakeVerifier("google"));
    expect(() => registry.register(makeFakeVerifier("google"))).toThrow();
  });

  it("returns the list of registered provider IDs", () => {
    const registry = new OidcVerifierRegistry();
    registry.register(makeFakeVerifier("google"));
    registry.register(makeFakeVerifier("microsoft"));
    expect(registry.registeredProviders).toEqual(["google", "microsoft"]);
  });
});
