import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../auth/auth-context";
import { useGoogleSignIn } from "../hooks/use-google-sign-in";

const ERROR_MESSAGES: Record<string, string> = {
  csrf_failed: "Security check failed. Please try again.",
  invalid_credential: "Sign-in failed. Please try again.",
  not_registered: "Your account is not registered. Contact an administrator.",
  internal: "An unexpected error occurred. Please try again.",
};

export function LoginPage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const returnTo = searchParams.get("returnTo") ?? "/";
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? "Sign-in failed.") : null;

  useEffect(() => {
    if (status === "authenticated") {
      void navigate(returnTo, { replace: true });
    }
  }, [status, navigate, returnTo]);

  const { buttonRef, error: gisError } = useGoogleSignIn(returnTo);

  if (status === "loading") return <p>Loading…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 80 }}>
      <h1>Sign in to Heim</h1>
      <div ref={buttonRef} style={{ marginTop: 24 }} />
      {(gisError ?? errorMessage) && (
        <p style={{ color: "#b91c1c", marginTop: 16 }}>{gisError ?? errorMessage}</p>
      )}
    </div>
  );
}
