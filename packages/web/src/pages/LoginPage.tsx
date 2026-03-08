import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../auth/auth-context";
import { useGoogleSignIn } from "../hooks/use-google-sign-in";

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      void navigate("/", { replace: true });
    }
  }, [status, navigate]);

  async function handleCredential(credential: string) {
    setLoginError(null);
    try {
      await login(credential);
    } catch {
      setLoginError("Sign-in failed. Please try again.");
    }
  }

  const { buttonRef, error: gisError } = useGoogleSignIn(handleCredential);

  if (status === "loading") return <p>Loading…</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 80 }}>
      <h1>Sign in to Heim</h1>
      <div ref={buttonRef} style={{ marginTop: 24 }} />
      {(gisError ?? loginError) && (
        <p style={{ color: "#b91c1c", marginTop: 16 }}>{gisError ?? loginError}</p>
      )}
    </div>
  );
}
