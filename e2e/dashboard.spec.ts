import path from "node:path";
import { expect, test } from "@playwright/test";

const workspaceRepositoryName = path.basename(process.cwd());
const apiBaseUrl = process.env.E2E_API_URL ?? "http://127.0.0.1:3747";

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

test("collects workflow text inputs and resolves them safely in a dry run", async ({ page, request }) => {
  const workflowName = `Input workflow ${Date.now()}`;
  const createResponse = await request.post(`${apiBaseUrl}/api/workflows`, {
    data: {
      name: workflowName,
      description: "Browser coverage for runtime workflow inputs",
      active: false,
      nodes: [
        {
          id: "input-e2e-trigger",
          type: "trigger.manual",
          name: "Avvio manuale",
          position: { x: 0, y: 0 },
          config: {}
        },
        {
          id: "input-e2e-message",
          type: "input.text",
          name: "Messaggio release",
          position: { x: 240, y: 0 },
          config: {
            key: "message",
            label: "Messaggio release",
            description: "Testo utilizzato dal comando",
            placeholder: "release candidate",
            defaultValue: "",
            required: true,
            multiline: false
          }
        },
        {
          id: "input-e2e-repositories",
          type: "repository.select",
          name: "Tutti i repository",
          position: { x: 480, y: 0 },
          config: { mode: "all", projectIds: [] }
        },
        {
          id: "input-e2e-command",
          type: "terminal.command",
          name: "Echo message",
          position: { x: 720, y: 0 },
          config: { command: "echo {{inputs.message}}" }
        },
        {
          id: "input-e2e-summary",
          type: "output.summary",
          name: "Riepilogo",
          position: { x: 960, y: 0 },
          config: {}
        }
      ],
      edges: [
        { id: "input-e2e-edge-1", source: "input-e2e-trigger", target: "input-e2e-message" },
        { id: "input-e2e-edge-2", source: "input-e2e-message", target: "input-e2e-repositories" },
        { id: "input-e2e-edge-3", source: "input-e2e-repositories", target: "input-e2e-command" },
        { id: "input-e2e-edge-4", source: "input-e2e-command", target: "input-e2e-summary" }
      ]
    }
  });
  expect(createResponse.ok()).toBe(true);
  const workflow = await createResponse.json();

  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Automazioni", exact: true }).click();
    await page.getByText(workflowName, { exact: true }).click();
    await page.getByRole("button", { name: "Anteprima", exact: true }).click();

    const executionDialog = page.getByRole("dialog", { name: "Anteprima workflow" });
    await expect(executionDialog).toBeVisible();
    await executionDialog.getByRole("textbox", { name: /Messaggio release/ }).fill("release candidate");

    const dryRunRequestPromise = page.waitForRequest((browserRequest) =>
      browserRequest.url().endsWith(`/api/workflows/${workflow.id}/dry-run`)
      && browserRequest.method() === "POST"
    );
    await executionDialog.getByRole("button", { name: "Genera anteprima" }).click();
    const dryRunRequest = await dryRunRequestPromise;
    expect(dryRunRequest.postDataJSON()).toEqual({
      inputs: { message: "release candidate" }
    });

    const resultDialog = page.getByRole("dialog");
    await expect(resultDialog).toContainText(workflowName);
    await expect(resultDialog).toContainText("Anteprima");
    await resultDialog.getByRole("button", { name: /Echo message/ }).click();
    await expect(resultDialog).toContainText('echo "${REPO_CONTROL_INPUT_MESSAGE}"');
    await expect(resultDialog).not.toContainText("release candidate");
  } finally {
    await request.delete(`${apiBaseUrl}/api/workflows/${workflow.id}`);
  }
});
