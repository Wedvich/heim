import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    reporters: process.env.CI ? ["default", "github-actions"] : ["default"],
  },
});
