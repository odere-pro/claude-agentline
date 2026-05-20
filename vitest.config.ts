import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/integration/**/*.test.ts", "tests/fuzz/**/*.test.ts"],
    testTimeout: 30000,
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      // Test scaffolding and pure type-only files are not coverage
      // targets. The ESLint guards already keep test-helpers/ out of
      // shipped code; excluding it here keeps the report focused on
      // the surfaces a regression could actually slip into.
      exclude: [
        "**/*.test.ts",
        "src/test-helpers/**",
        "dist/**",
        "tests/**",
        "**/*.config.ts",
        "scripts/**",
      ],
      // Soft floors set just under the current measured baseline so
      // the first PR doesn't fail the new gate. Raise these as the
      // suite tightens; the eventual target is 80%.
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },
  },
});
