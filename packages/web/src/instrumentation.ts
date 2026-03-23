import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router";
import type { Session } from "./auth/api";

const tracePropagationTargets = import.meta.env.CORS_ORIGIN
  ? [import.meta.env.CORS_ORIGIN]
  : undefined;

const tracesSampleRate = import.meta.env.SENTRY_WEB_SAMPLE_RATE
  ? Number(import.meta.env.SENTRY_WEB_SAMPLE_RATE)
  : 1.0;

Sentry.init({
  dsn: import.meta.env.SENTRY_WEB_DSN,
  environment: import.meta.env.MODE,
  transport: Sentry.makeBrowserOfflineTransport(Sentry.makeFetchTransport),
  integrations: [
    Sentry.reactRouterV7BrowserTracingIntegration({
      useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
  ],
  tracePropagationTargets,
  tracesSampleRate,
});

export function setInstrumentationContext(session: Session | null): void {
  if (session) {
    Sentry.setUser({ id: session.principal.id });
    Sentry.setTag("tenant_id", session.tenant?.id);
  } else {
    Sentry.setUser(null);
    Sentry.setTag("tenant_id", undefined);
  }
}
