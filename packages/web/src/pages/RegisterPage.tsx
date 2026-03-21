import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../auth/auth-context";
import { fetchInviteStatus } from "../auth/api";
import { useGoogleSignIn } from "../hooks/use-google-sign-in";

const ERROR_MESSAGES: Record<string, string> = {
  csrf_failed: "Security check failed. Please try again.",
  invalid_credential: "Sign-up failed. Please try again.",
  invalid_invite: "This invite link is invalid or has expired.",
  invalid_request: "Invalid request. Please use a valid invite link.",
  already_registered: "This account is already registered. Try signing in instead.",
  verification_failed: "Google sign-in verification failed. Please try again.",
  unknown_provider: "Unsupported sign-in provider.",
  internal: "An unexpected error occurred. Please try again.",
};

type InviteStatus = "loading" | "valid" | "invalid";

export function RegisterPage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>("loading");

  const inviteCode = searchParams.get("invite");
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? "Sign-up failed.") : null;

  useEffect(() => {
    if (status === "authenticated") {
      void navigate("/", { replace: true });
    }
  }, [status, navigate]);

  useEffect(() => {
    if (!inviteCode) {
      setInviteStatus("invalid");
      return;
    }

    fetchInviteStatus(inviteCode)
      .then((result) => setInviteStatus(result.valid ? "valid" : "invalid"))
      .catch(() => setInviteStatus("invalid"));
  }, [inviteCode]);

  const { buttonRef, error: gisError } = useGoogleSignIn("/", {
    state: inviteCode ? JSON.stringify({ invite: inviteCode, returnTo: "/" }) : undefined,
  });

  if (status === "loading" || inviteStatus === "loading") return <p>Loading…</p>;

  if (!inviteCode || inviteStatus === "invalid") {
    return (
      <div
        style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 80 }}
      >
        <h1>Register for Heim</h1>
        <p style={{ color: "var(--color-error)", marginTop: 16 }}>
          {inviteCode
            ? "This invite link is invalid or has expired."
            : "An invite link is required to register."}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 80 }}>
      <h1>Register for Heim</h1>
      <div ref={buttonRef} style={{ marginTop: 24, colorScheme: "light" }} />
      {(gisError ?? errorMessage) && (
        <p style={{ color: "var(--color-error)", marginTop: 16 }}>{gisError ?? errorMessage}</p>
      )}
    </div>
  );
}
