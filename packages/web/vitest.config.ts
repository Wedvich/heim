import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    passWithNoTests: true,
    reporters: process.env.CI ? ["default", "github-actions"] : ["default"],
  },
});
