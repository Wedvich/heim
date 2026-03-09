import { defineConfig, defaultInclude } from "vitest/config";

export default defineConfig({
  test: {
    include: [...defaultInclude, "tests/**/*.test.ts"],
    passWithNoTests: true,
    reporters: process.env.CI ? ["default", "github-actions"] : ["default"],
  },
});
