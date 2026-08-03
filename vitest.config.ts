import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    testTimeout: 10_000,
    include: ["apps/web/src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./apps/web/src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/web",
      reporter: ["text", "html", "json-summary"],
      include: ["apps/web/src/**/*.{ts,tsx}"],
      exclude: [
        "apps/web/src/**/*.{test,spec}.{ts,tsx}",
        "apps/web/src/test/**",
        "apps/web/src/types/**",
        "apps/web/src/main.tsx"
      ],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80
      }
    }
  }
});
