import * as Sentry from "@sentry/node";

const tracesSampleRate = process.env.SENTRY_API_SAMPLE_RATE
  ? Number(process.env.SENTRY_API_SAMPLE_RATE)
  : 1.0;

Sentry.init({
  dsn: process.env.SENTRY_API_DSN,
  environment: process.env.NODE_ENV ?? "development",
  tracesSampleRate,
});
