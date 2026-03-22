import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../auth/auth-context";
import { fetchInviteStatus, type InviteStatus } from "../auth/api";
import { useGoogleSignIn } from "../hooks/use-google-sign-in";

const ERROR_MESSAGES: Record<string, string> = {
  csrf_failed: "Security check failed. Please try again.",
  invalid_credential: "Sign-up failed. Please try again.",
  invalid_invite: "This invite link is invalid or has expired.",
  invalid_request: "Invalid request. Please use a valid invite link.",
  already_registered: "This account is already registered. Try signing in instead.",
  verification_failed: "Google sign-in verification failed. Please try again.",
  unknown_provider: "Unsupported sign-in provider.",
  registration_expired: "Your registration session expired. Please sign in with Google again.",
  internal: "An unexpected error occurred. Please try again.",
};

type PageStatus = "loading" | "ready" | "invalid";

export function RegisterPage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const [inviteInfo, setInviteInfo] = useState<InviteStatus | null>(null);

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
      setPageStatus("invalid");
      return;
    }

    fetchInviteStatus(inviteCode)
      .then((result) => {
        if (result.valid) {
          setInviteInfo(result);
          setPageStatus("ready");
        } else {
          setPageStatus("invalid");
        }
      })
      .catch(() => setPageStatus("invalid"));
  }, [inviteCode]);

  const { buttonRef, error: gisError } = useGoogleSignIn("/", {
    state: inviteCode ? JSON.stringify({ invite: inviteCode, returnTo: "/" }) : undefined,
  });

  if (status === "loading" || pageStatus === "loading") return <p>Loading…</p>;

  if (!inviteCode || pageStatus === "invalid") {
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
      {inviteInfo?.type === "join" && inviteInfo.tenantName && (
        <p style={{ color: "var(--color-muted)", marginTop: 8 }}>
          You&apos;ve been invited to join <strong>{inviteInfo.tenantName}</strong>
        </p>
      )}
      <div ref={buttonRef} style={{ marginTop: 24, colorScheme: "light" }} />
      {(gisError ?? errorMessage) && (
        <p style={{ color: "var(--color-error)", marginTop: 16 }}>{gisError ?? errorMessage}</p>
      )}
    </div>
  );
}
