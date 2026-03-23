import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", ["CORS_", "GOOGLE_", "SENTRY_WEB_"]);
  return {
    plugins: [react()],
    define: {
      "import.meta.env.CORS_ORIGIN": JSON.stringify(env["CORS_ORIGIN"] ?? ""),
      "import.meta.env.GOOGLE_CLIENT_ID": JSON.stringify(env["GOOGLE_CLIENT_ID"] ?? ""),
      "import.meta.env.SENTRY_WEB_DSN": JSON.stringify(env["SENTRY_WEB_DSN"] ?? ""),
      "import.meta.env.SENTRY_WEB_SAMPLE_RATE": JSON.stringify(env["SENTRY_WEB_SAMPLE_RATE"] ?? ""),
    },
    server: {
      open: true,
      port: 5243,
      proxy: {
        "/api": "http://localhost:5244",
      },
    },
  };
});
