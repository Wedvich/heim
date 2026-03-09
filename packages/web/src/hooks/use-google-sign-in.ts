import { useCallback, useEffect, useState } from "react";

declare global {
  interface Window {
    google: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            ux_mode: "redirect";
            login_uri: string;
            state?: string;
          }) => void;
          renderButton: (element: HTMLElement, options: { theme?: string; size?: string }) => void;
        };
      };
    };
  }
}

export function useGoogleSignIn(returnTo: string) {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const clientId = import.meta.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError("GOOGLE_CLIENT_ID is not configured");
      return;
    }

    const loginUri = window.location.origin + "/api/auth/google/callback";

    function initializeGis() {
      window.google.accounts.id.initialize({
        client_id: clientId,
        ux_mode: "redirect",
        login_uri: loginUri,
        state: returnTo,
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
  }, [returnTo]);

  const buttonRef = useCallback(
    (el: HTMLElement | null) => {
      if (!el || !initialized) return;
      window.google.accounts.id.renderButton(el, { theme: "outline", size: "large" });
    },
    [initialized],
  );

  return { ready: initialized, buttonRef, error };
}
