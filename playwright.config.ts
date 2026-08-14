import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const apiPort = process.env.E2E_API_PORT ?? "3747";
const webPort = process.env.E2E_WEB_PORT ?? "5173";
const apiBaseUrl = `http://127.0.0.1:${apiPort}`;
const webBaseUrl = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: "./e2e",
  // Browser scenarios share one local API and some mutate workflow state.
  // Keep this spec sequential so tests cannot invalidate each other's active workflow.
  fullyParallel: false,
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
      url: `${apiBaseUrl}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        HOST: "127.0.0.1",
        PORT: apiPort,
        LOG_LEVEL: "error",
        REPO_CONTROL_ROOT: process.cwd(),
        REPO_CONTROL_CONFIG_DIR: path.join(process.cwd(), ".repo-control", "e2e")
      }
    },
    {
      command: `npm run dev:web -- --port ${webPort}`,
      url: webBaseUrl,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        REPO_CONTROL_API_URL: apiBaseUrl
      }
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
