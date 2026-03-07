import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    open: true,
    port: 5243,
    proxy: {
      "/api": "http://localhost:5244",
    },
  },
});
