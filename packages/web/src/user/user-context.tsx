import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { HydratedUserEvent, UserState } from "@heim/domain";
import { buildUserAggregate } from "@heim/domain";
import { useAuth } from "../auth/auth-context";
import { fetchUserEvents } from "./api";

interface UserContextValue {
  user: UserState | null;
  loading: boolean;
}

const UserContext = createContext<UserContextValue>({ user: null, loading: true });

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const [user, setUser] = useState<UserState | null>(null);
  const [loading, setLoading] = useState(true);
  const eventsRef = useRef<HydratedUserEvent[]>([]);
  const versionRef = useRef<number>(0);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "unauthenticated") {
      eventsRef.current = [];
      versionRef.current = 0;
      setUser(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    fetchUserEvents(versionRef.current === 0 ? undefined : versionRef.current)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setUser(null);
          setLoading(false);
          return;
        }
        eventsRef.current = [...eventsRef.current, ...result.events];
        versionRef.current = result.version;
        const aggregate = buildUserAggregate(eventsRef.current);
        setUser(aggregate.state);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  return <UserContext value={{ user, loading }}>{children}</UserContext>;
}

export function useUser(): UserContextValue {
  return useContext(UserContext);
}
