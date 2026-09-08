import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const port = process.env.DEMO_TEST_PORT || "5473";
const base = `http://127.0.0.1:${port}${process.env.DEMO_BASE_PATH || "/repo-control/"}`;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "preview",
    "apps/web",
    "--mode",
    "demo",
    "--host",
    "127.0.0.1",
    "--port",
    port,
    "--strictPort",
  ],
  { stdio: "pipe" },
);
let browser;
let logs = "";
server.stdout.on("data", (chunk) => {
  logs += chunk;
});
server.stderr.on("data", (chunk) => {
  logs += chunk;
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(logs);
    try {
      if ((await fetch(base)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* Preview is starting. */
    }
    await delay(100);
  }
  assert.ok(ready, logs);
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  const apiRequests = [];
  const failures = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(base);
  await page
    .getByText("Demo workspace · Changes stay in this browser")
    .waitFor();
  await page
    .getByRole("button", { name: "Open atlas-api", exact: true })
    .first()
    .click();
  await page.getByRole("tab", { name: /^Changes/ }).click();
  await page.getByRole("button", { name: "Stage all", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Commit message" })
    .fill("Document the first run");
  await page.getByRole("button", { name: "Commit", exact: true }).click();
  await page.getByText("1 ahead", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Push", exact: true }).click();
  await page.getByText("0 ahead", { exact: true }).waitFor();
  await page.locator('[data-dashboard-section="agents"]').first().click();
  await page.getByText("Add workspace onboarding", { exact: true }).waitFor();
  await page.locator('[data-dashboard-section="automations"]').first().click();
  await page
    .getByText("Morning workspace check", { exact: true })
    .first()
    .waitFor();
  await page
    .getByRole("button", { name: "Run on your machine", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Windows · PowerShell" }).waitFor();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page
    .getByRole("button", { name: "Open atlas-api", exact: true })
    .first()
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: "Run on your machine", exact: true })
    .waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Demo should fit a mobile viewport",
  );
  assert.deepEqual(
    apiRequests,
    [],
    "Static demo must never send API requests to a server",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(failures, []);
  console.log(
    "PASS: static demo, staging/commit/push, sessions, automation navigation, install instructions, reset, mobile layout; no network API calls or missing assets.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
