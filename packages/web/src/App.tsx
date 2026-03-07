import { useEffect, useState } from "react";

interface ApiResult {
  status: number;
  body: unknown;
}

export function App(): React.JSX.Element {
  const [healthStatus, setHealthStatus] = useState<string>("loading…");
  const [sessionResult, setSessionResult] = useState<ApiResult | null>(null);
  const [idToken, setIdToken] = useState("");
  const [loginResult, setLoginResult] = useState<ApiResult | null>(null);
  const [logoutResult, setLogoutResult] = useState<ApiResult | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("unreachable"));

    function setStatus(s: string) {
      setHealthStatus(s);
    }
  }, []);

  async function checkSession() {
    try {
      const res = await fetch("/api/auth/session");
      const body: unknown = await res.json();
      setSessionResult({ status: res.status, body });
    } catch {
      setSessionResult({ status: 0, body: { error: "fetch_failed" } });
    }
  }

  async function login() {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google", credential: idToken.trim() }),
      });
      const body: unknown = await res.json();
      setLoginResult({ status: res.status, body });
    } catch {
      setLoginResult({ status: 0, body: { error: "fetch_failed" } });
    }
  }

  async function logout() {
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      const body: unknown = await res.json();
      setLogoutResult({ status: res.status, body });
    } catch {
      setLogoutResult({ status: 0, body: { error: "fetch_failed" } });
    }
  }

  return (
    <>
      <h1>Heim</h1>
      <p>API: {healthStatus}</p>
      <div style={{ display: "flex", gap: 8, alignItems: "start", marginTop: 16 }}>
        <button onClick={checkSession} style={{ padding: "8px 16px", cursor: "pointer" }}>
          Check Session
        </button>
        <button onClick={logout} style={{ padding: "8px 16px", cursor: "pointer" }}>
          Logout
        </button>
        <textarea
          value={idToken}
          onChange={(e) => setIdToken(e.target.value)}
          placeholder="Paste Google ID token here…"
          rows={3}
          style={{ width: 400, fontFamily: "monospace", fontSize: 12 }}
        />
        <button
          onClick={login}
          disabled={!idToken.trim()}
          style={{ padding: "8px 16px", cursor: "pointer" }}
        >
          Login
        </button>
      </div>
      <ResultBlock result={sessionResult} label="Session" />
      <ResultBlock result={loginResult} label="Login" />
      <ResultBlock result={logoutResult} label="Logout" />
    </>
  );
}

function ResultBlock({ result, label }: { result: ApiResult | null; label: string }) {
  if (!result) return null;
  const isSuccess = result.status >= 200 && result.status < 300;
  return (
    <pre
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 6,
        color: "#fff",
        backgroundColor: isSuccess ? "#15803d" : "#b91c1c",
        maxWidth: 600,
        overflow: "auto",
      }}
    >
      {`${label}: HTTP ${result.status}\n${JSON.stringify(result.body, null, 2)}`}
    </pre>
  );
}
