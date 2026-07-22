import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const webBaseUrl = "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: webBaseUrl,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: [
    {
      command: "node --import tsx apps/server/src/index.ts",
      url: "http://127.0.0.1:3747/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: "3747",
        LOG_LEVEL: "error",
        REPO_CONTROL_ROOT: process.cwd(),
        REPO_CONTROL_CONFIG_DIR: path.join(process.cwd(), ".repo-control", "e2e")
      }
    },
    {
      command: "npm run dev:web",
      url: webBaseUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe"
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
