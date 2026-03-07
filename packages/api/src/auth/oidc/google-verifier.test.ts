import { beforeEach, describe, expect, it, vi } from "vitest";
import { OAuth2Client } from "google-auth-library";
import { GoogleOidcVerifier } from "./google-verifier.ts";
import { TokenVerificationError } from "./types.ts";

const mockVerifyIdToken = vi.spyOn(OAuth2Client.prototype, "verifyIdToken");

describe("GoogleOidcVerifier", () => {
  const verifier = new GoogleOidcVerifier({ clientId: "test-client-id" });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("maps a valid token payload to VerifiedIdentity", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: "google-sub-123",
        email: "user@example.com",
        email_verified: true,
        name: "Test User",
        picture: "https://example.com/photo.jpg",
      }),
    } as unknown as ReturnType<OAuth2Client["verifyIdToken"]>);

    const result = await verifier.verify("valid-token");

    expect(result).toEqual({
      provider: "google",
      providerSubjectId: "google-sub-123",
      email: "user@example.com",
      emailVerified: true,
      name: "Test User",
      avatarUrl: "https://example.com/photo.jpg",
    });
  });

  it("throws TokenVerificationError when sub is missing", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ email: "user@example.com" }),
    } as unknown as ReturnType<OAuth2Client["verifyIdToken"]>);

    await expect(verifier.verify("token")).rejects.toThrow(TokenVerificationError);
  });

  it("throws TokenVerificationError when email is missing", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: "google-sub-123" }),
    } as unknown as ReturnType<OAuth2Client["verifyIdToken"]>);

    await expect(verifier.verify("token")).rejects.toThrow(TokenVerificationError);
  });

  it("throws TokenVerificationError when the library throws, preserving cause", async () => {
    const cause = new Error("Token expired");
    mockVerifyIdToken.mockRejectedValue(cause);

    const error = await verifier.verify("expired-token").catch((e) => e);
    expect(error).toBeInstanceOf(TokenVerificationError);
    expect(error.cause).toBe(cause);
  });

  it("defaults emailVerified to false when email_verified is absent", async () => {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({ sub: "google-sub-123", email: "user@example.com" }),
    } as unknown as ReturnType<OAuth2Client["verifyIdToken"]>);

    const result = await verifier.verify("token");
    expect(result.emailVerified).toBe(false);
  });
});
