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

test("keeps application background motion lightweight and respects reduced motion", async ({ page }) => {
  await page.goto("/");

  const backdrop = page.locator("[data-app-motion-backdrop]");
  await expect(backdrop).toBeAttached();
  await expect(backdrop.locator("[data-app-motion-layer]")).toHaveCount(1);

  await expect.poll(async () =>
    backdrop.evaluate((element) => element.getAnimations({ subtree: true }).length)
  ).toBeGreaterThan(0);
  expect(
    await backdrop.evaluate((element) => element.getAnimations({ subtree: true }).length)
  ).toBeLessThanOrEqual(2);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(async () =>
    backdrop.evaluate((element) => element.getAnimations({ subtree: true }).length)
  ).toBe(0);
  expect(
    await backdrop.locator("[data-app-motion-layer]").evaluateAll((layers) =>
      layers.every((layer) => getComputedStyle(layer).willChange === "auto")
    )
  ).toBe(true);
});

test("shares one motion backdrop across every dashboard section", async ({ page }) => {
  test.slow();
  await page.goto("/");

  const backdrop = page.locator("[data-app-motion-backdrop]");
  await expect(page.locator('[data-dashboard-section="docker"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Docker: Controlla i servizi" })).toHaveCount(0);

  for (const section of ["favorites", "repositories", "overview", "automations"]) {
    const navigationButton = page.locator(`[data-dashboard-section="${section}"]`).first();
    await navigationButton.click();
    await expect(navigationButton).toHaveAttribute("aria-current", "page");
    await expect(backdrop).toHaveCount(1);
  }
});

test("switches and persists all five dashboard color palettes", async ({ page }) => {
  await page.goto("/");

  const palettePicker = page.getByRole("button", {
    name: /Seleziona palette colori/
  });
  const palettes = [
    ["Bianco", "white"],
    ["Nero", "black"],
    ["Rosso", "red"],
    ["Blu", "blue"],
    ["Verde", "green"]
  ] as const;
  const renderedBackgrounds: string[] = [];

  for (const [label, value] of palettes) {
    await palettePicker.click();
    await page.getByRole("menuitemradio", { name: label, exact: true }).click();
    await expect(palettePicker).toHaveAttribute("aria-label", `Seleziona palette colori. Attiva: ${label}`);
    expect(
      await page.evaluate(() => window.localStorage.getItem("repo-control-color-palette"))
    ).toBe(value);
    renderedBackgrounds.push(
      await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    );
  }

  expect(new Set(renderedBackgrounds).size).toBe(palettes.length);
});

test("navigates between lazy dashboard sections without browser errors", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Cosa vuoi fare oggi?" })).toBeVisible();

  await page.getByRole("button", { name: "Automazioni", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Automazioni", exact: true })).toBeVisible();
  await expect(page.getByLabel("Canvas automazione")).toBeVisible();

  await page.getByRole("button", { name: /Repository/ }).first().click();
  await expect(page.getByRole("heading", { name: "Repository", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: `Apri ${workspaceRepositoryName}` })).toBeVisible();

  expect(browserErrors).toEqual([]);
});

test("detects local coding agents and opens the unified session history", async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  const sessionsResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/agent-sessions") && response.request().method() === "GET"
  );

  await page.goto("/");
  await page.locator('[data-dashboard-section="agents"]').first().click();

  const sessionsResponse = await sessionsResponsePromise;
  const sessionsPayload = await sessionsResponse.json();
  expect(sessionsResponse.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Agent sessions", exact: true })).toBeVisible();
  await expect(page.getByLabel("Agent rilevati")).toContainText("Claude Code");
  await expect(page.getByLabel("Agent rilevati")).toContainText("Codex");
  await expect(page.getByLabel("Agent rilevati")).toContainText("Gemini CLI");
  await expect(page.getByText("Più recenti prima")).toBeVisible();

  const firstSession = sessionsPayload.sessions[0] as { title: string } | undefined;

  if (firstSession) {
    const searchResponsePromise = page.waitForResponse((response) =>
      response.url().includes("/api/agent-sessions?search=") && response.request().method() === "GET"
    );
    const sessionSearch = page.getByRole("textbox", {
      name: "Cerca nei titoli e nel contenuto delle chat"
    });
    await sessionSearch.fill(firstSession.title);

    const searchResponse = await searchResponsePromise;
    const searchPayload = await searchResponse.json();
    expect(searchResponse.status()).toBe(200);
    expect(searchPayload.sessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: firstSession.title })
    ]));
    await expect(page.getByText("Nel titolo").first()).toBeVisible();

    await sessionSearch.fill("");
    await expect(page.getByText("Nel titolo")).toHaveCount(0);
  }

  for (const label of ["Claude Code", "Codex", "Gemini CLI"]) {
    const providerFilter = page.getByRole("button", { name: new RegExp(`Filtra per ${label}`) });
    await providerFilter.click();
    await expect(providerFilter).toHaveAttribute("aria-pressed", "true");
    await providerFilter.click();
    await expect(providerFilter).toHaveAttribute("aria-pressed", "false");
  }

  const providerWithSessions = sessionsPayload.agents.find(
    (agent: { sessionCount: number }) => agent.sessionCount > 0
  );

  if (providerWithSessions) {
    await page.getByRole("button", {
      name: new RegExp(`Filtra per ${providerWithSessions.label}`)
    }).click();
    const sessionRows = page.getByRole("list", { name: "Sessioni agent" }).getByRole("listitem");
    await expect(sessionRows.first()).toBeVisible();
    await expect(sessionRows).toHaveCount(providerWithSessions.sessionCount);
    expect(
      await sessionRows.evaluateAll((rows, providerLabel) =>
        rows.every((row) => row.textContent?.includes(providerLabel as string)),
      providerWithSessions.label)
    ).toBe(true);
  }

  await expect(page.locator(".vite-error-overlay")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.innerText.trim().length)).toBeGreaterThan(0);
  expect(browserErrors).toEqual([]);
  await testInfo.attach("agent-sessions", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });
  if (process.env.E2E_AGENT_SCREENSHOT_PATH) {
    await page.screenshot({ path: process.env.E2E_AGENT_SCREENSHOT_PATH, fullPage: true });
  }
});

test("uses focused automation editor views and a searchable node library", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Automazioni", exact: true }).click();

  await expect(page.getByLabel("Canvas automazione")).toBeVisible();
  await page.getByRole("button", { name: "Aggiungi passaggio", exact: true }).click();

  const nodeLibrary = page.getByRole("complementary", { name: "Libreria nodi" });
  await expect(nodeLibrary).toBeVisible();
  await nodeLibrary.getByRole("textbox", { name: "Cerca nella libreria nodi" }).fill("Docker");
  await expect(nodeLibrary.getByText("Compose up", { exact: true })).toBeVisible();
  await nodeLibrary.getByRole("button", { name: "Chiudi libreria nodi" }).click();

  await page.getByRole("tab", { name: /Esecuzioni/ }).click();
  await expect(page.getByRole("region", { name: "Esecuzioni workflow" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cronologia" })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(
    await page.evaluate(() => window.innerHeight)
  );
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
    await page.locator('button[aria-haspopup="menu"]').filter({ hasText: "Workflow attivo" }).click();
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
    await resultDialog.getByRole("button", { name: /Echo message/ }).first().click();
    await expect(resultDialog).toContainText('echo "${REPO_CONTROL_INPUT_MESSAGE}"');
    await expect(resultDialog).not.toContainText("release candidate");
  } finally {
    await request.delete(`${apiBaseUrl}/api/workflows/${workflow.id}`);
  }
});
