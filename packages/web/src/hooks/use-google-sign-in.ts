import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement, options: { theme?: string; size?: string }) => void;
        };
      };
    };
  }
}

export function useGoogleSignIn(onCredential: (credential: string) => void) {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onCredentialRef = useRef(onCredential);
  onCredentialRef.current = onCredential;

  useEffect(() => {
    const clientId = import.meta.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError("GOOGLE_CLIENT_ID is not configured");
      return;
    }

    function initializeGis() {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => onCredentialRef.current(response.credential),
      });
      setInitialized(true);
    }

    if (window.google?.accounts?.id) {
      initializeGis();
      return;
    }

    if (document.getElementById("gis-script")) return;

    const script = document.createElement("script");
    script.id = "gis-script";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => initializeGis();
    script.onerror = () => setError("Failed to load Google Sign-In");
    document.head.appendChild(script);
  }, []);

  const buttonRef = useCallback(
    (el: HTMLElement | null) => {
      if (!el || !initialized) return;
      window.google.accounts.id.renderButton(el, { theme: "outline", size: "large" });
    },
    [initialized],
  );

  return { ready: initialized, buttonRef, error };
}
