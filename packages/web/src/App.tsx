import { useEffect, useState } from "react";

interface SessionResult {
  status: number;
  body: unknown;
}

export function App(): React.JSX.Element {
  const [healthStatus, setHealthStatus] = useState<string>("loading…");
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(null);

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

  const isSuccess =
    sessionResult !== null && sessionResult.status >= 200 && sessionResult.status < 300;
  const isError = sessionResult !== null && !isSuccess;

  return (
    <>
      <h1>Heim</h1>
      <p>API: {healthStatus}</p>
      <button
        onClick={checkSession}
        style={{ marginTop: 16, padding: "8px 16px", cursor: "pointer" }}
      >
        Check Session
      </button>
      {sessionResult && (
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 6,
            color: "#fff",
            backgroundColor: isError ? "#b91c1c" : "#15803d",
            maxWidth: 600,
            overflow: "auto",
          }}
        >
          {`HTTP ${sessionResult.status}\n${JSON.stringify(sessionResult.body, null, 2)}`}
        </pre>
      )}
    </>
  );
}
