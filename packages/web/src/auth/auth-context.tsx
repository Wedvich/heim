import { createContext, useContext, useEffect, useRef, useState } from "react";
import { fetchSession, postLogout, type Session } from "./api";

type Status = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  status: Status;
  session: Session | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  status: "loading",
  session: null,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    fetchSession()
      .then((s) => {
        if (!mounted.current) return;
        setSession(s);
        setStatus(s ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        if (!mounted.current) return;
        setStatus("unauthenticated");
      });
    return () => {
      mounted.current = false;
    };
  }, []);

  async function logout() {
    await postLogout();
    setSession(null);
    setStatus("unauthenticated");
  }

  return <AuthContext value={{ status, session, logout }}>{children}</AuthContext>;
}

export function useAuth() {
  return useContext(AuthContext);
}
