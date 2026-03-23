/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly CORS_ORIGIN: string;
  readonly GOOGLE_CLIENT_ID: string;
  readonly SENTRY_WEB_DSN: string;
  readonly SENTRY_WEB_SAMPLE_RATE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
