import path from "node:path";
import { expect, test } from "@playwright/test";

const workspaceRepositoryName = path.basename(process.cwd());

test.beforeEach(async ({ page }) => {
  await page.route("**/api/docker/containers", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        containers: [],
        groups: [],
        checkedAt: new Date(0).toISOString(),
        error: "Docker disabled during browser tests"
      })
    });
  });

  await page.route("**/api/app/update-status", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        currentVersion: "0.1.11",
        latestVersion: null,
        updateAvailable: false,
        checkedAt: new Date(0).toISOString(),
        error: null
      })
    });
  });
});

test("loads live workspace data and opens a repository from the keyboard palette", async ({ page }) => {
  const projectsResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/projects") && response.request().method() === "GET"
  );

  await page.goto("/");
  const projectsResponse = await projectsResponsePromise;
  const projectsPayload = await projectsResponse.json();

  expect(projectsResponse.status()).toBe(200);
  expect(projectsPayload.root).toBe(process.cwd());
  expect(projectsPayload.projects).toEqual(expect.arrayContaining([
    expect.objectContaining({ name: workspaceRepositoryName })
  ]));
  await expect(page.getByRole("heading", { name: "Cosa vuoi fare oggi?" })).toBeVisible();

  await page.keyboard.press("Control+P");
  const palette = page.getByRole("dialog", { name: "Repository command palette" });
  await expect(palette).toBeVisible();
  const searchInput = palette.getByPlaceholder("Cerca repository (Ctrl+P)");
  await expect(searchInput).toBeFocused();
  await searchInput.fill(workspaceRepositoryName);
  await expect(palette.getByText(workspaceRepositoryName, { exact: true })).toBeVisible();
  await searchInput.press("Enter");

  await expect(palette).toBeHidden();
  await expect(page.getByRole("tabpanel", { name: `Repository ${workspaceRepositoryName}` })).toBeVisible();
  await expect(page.getByRole("heading", { name: workspaceRepositoryName })).toBeVisible();
});

test("navigates between lazy dashboard sections without browser errors", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cosa vuoi fare oggi?" })).toBeVisible();

  await page.getByRole("button", { name: "Automazioni", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Automazioni", exact: true })).toBeVisible();
  await expect(page.getByText("Visual workflows")).toBeVisible();

  await page.getByRole("button", { name: /Repository/ }).first().click();
  await expect(page.getByRole("heading", { name: "Repository", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Apri ${workspaceRepositoryName}` })).toBeVisible();

  expect(browserErrors).toEqual([]);
});
