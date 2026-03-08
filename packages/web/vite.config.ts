import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", "GOOGLE_");
  return {
    plugins: [react()],
    define: {
      "import.meta.env.GOOGLE_CLIENT_ID": JSON.stringify(env["GOOGLE_CLIENT_ID"] ?? ""),
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
