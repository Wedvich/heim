import { useCallback, useEffect, useState } from "react";

export interface GoogleSignInOptions {
  state?: string;
}

export function useGoogleSignIn(returnTo: string, options?: GoogleSignInOptions) {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stateOverride = options?.state;

  useEffect(() => {
    const clientId = import.meta.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError("GOOGLE_CLIENT_ID is not configured");
      return;
    }

    const loginUri = window.location.origin + "/api/auth/google/callback";
    const state = stateOverride ?? returnTo;

    function initializeGis() {
      window.google.accounts.id.initialize({
        client_id: clientId,
        ux_mode: "redirect",
        login_uri: loginUri,
        state,
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
  }, [returnTo, stateOverride]);

  const buttonRef = useCallback(
    (el: HTMLElement | null) => {
      if (!el || !initialized) return;
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      window.google.accounts.id.renderButton(el, {
        theme: isDark ? "filled_black" : "outline",
        size: "large",
      });
    },
    [initialized],
  );

  return { ready: initialized, buttonRef, error };
}
