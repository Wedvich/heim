import { useEffect, useState } from "react";

export function App(): React.JSX.Element {
  const [status, setStatus] = useState<string>("loading…");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("unreachable"));
  }, []);

  return (
    <>
      <h1>Heim</h1>
      <p>API: {status}</p>
    </>
  );
}
