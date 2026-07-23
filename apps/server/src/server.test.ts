import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { createServer } from "./server.js";

const execFileAsync = promisify(execFile);

test("boots the API and serves safe workspace endpoints", async (context) => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-server-test-"));
  const configPath = path.join(temporaryRoot, "config");
  const nextWorkspacePath = path.join(temporaryRoot, "next-workspace");
  const previousRoot = process.env.REPO_CONTROL_ROOT;
  const previousConfigPath = process.env.REPO_CONTROL_CONFIG_DIR;

  process.env.REPO_CONTROL_ROOT = temporaryRoot;
  process.env.REPO_CONTROL_CONFIG_DIR = configPath;
  await fs.mkdir(nextWorkspacePath);

  const { app } = await createServer();

  context.after(async () => {
    await app.close();

    if (previousRoot === undefined) delete process.env.REPO_CONTROL_ROOT;
    else process.env.REPO_CONTROL_ROOT = previousRoot;

    if (previousConfigPath === undefined) delete process.env.REPO_CONTROL_CONFIG_DIR;
    else process.env.REPO_CONTROL_CONFIG_DIR = previousConfigPath;

    await fs.rm(temporaryRoot, { recursive: true, force: true });
  });

  const healthResponse = await app.inject({
    method: "GET",
    url: "/api/health",
    headers: { origin: "http://127.0.0.1:5173" }
  });

  assert.equal(healthResponse.statusCode, 200);
  assert.deepEqual(healthResponse.json(), { ok: true, root: temporaryRoot });
  assert.equal(
    healthResponse.headers["access-control-allow-origin"],
    "http://127.0.0.1:5173"
  );

  const projectsResponse = await app.inject({ method: "GET", url: "/api/projects" });
  assert.equal(projectsResponse.statusCode, 200);
  assert.deepEqual(projectsResponse.json(), { root: temporaryRoot, projects: [] });

  const preferencesUpdateResponse = await app.inject({
    method: "PUT",
    url: "/api/preferences",
    payload: { favoriteProjectIds: ["project-one", "project-one", "project-two"] }
  });
  assert.equal(preferencesUpdateResponse.statusCode, 200);
  assert.deepEqual(preferencesUpdateResponse.json(), {
    favoriteProjectIds: ["project-one", "project-two"]
  });

  const invalidRootResponse = await app.inject({
    method: "POST",
    url: "/api/root",
    payload: { root: path.join(temporaryRoot, "missing") }
  });
  assert.equal(invalidRootResponse.statusCode, 400);

  await createRepository(path.join(nextWorkspacePath, "input-project"));

  const rootUpdateResponse = await app.inject({
    method: "POST",
    url: "/api/root",
    payload: { root: nextWorkspacePath }
  });
  assert.equal(rootUpdateResponse.statusCode, 200);
  assert.deepEqual(rootUpdateResponse.json(), { ok: true, root: nextWorkspacePath });

  const workflowsResponse = await app.inject({ method: "GET", url: "/api/workflows" });
  assert.equal(workflowsResponse.statusCode, 200);
  assert.equal(workflowsResponse.json().workflows.length, 1);

  const inputWorkflowResponse = await app.inject({
    method: "POST",
    url: "/api/workflows",
    payload: {
      name: "Input workflow",
      description: "Collects a release message",
      active: false,
      nodes: [
        {
          id: "trigger",
          type: "trigger.manual",
          name: "Manual trigger",
          position: { x: 0, y: 0 },
          config: {}
        },
        {
          id: "message-input",
          type: "input.text",
          name: "Release message",
          position: { x: 200, y: 0 },
          config: {
            key: "message",
            label: "Release message",
            required: true,
            defaultValue: ""
          }
        },
        {
          id: "input-repositories",
          type: "repository.select",
          name: "All repositories",
          position: { x: 400, y: 0 },
          config: { mode: "all", projectIds: [] }
        },
        {
          id: "input-command",
          type: "terminal.command",
          name: "Echo input",
          position: { x: 600, y: 0 },
          config: { command: "echo {{inputs.message}}" }
        }
      ],
      edges: [
        { id: "trigger-input", source: "trigger", target: "message-input" },
        { id: "edge-input-repositories", source: "message-input", target: "input-repositories" },
        { id: "repositories-command", source: "input-repositories", target: "input-command" }
      ]
    }
  });
  assert.equal(inputWorkflowResponse.statusCode, 200);
  const inputWorkflowId = inputWorkflowResponse.json().id;

  const missingInputResponse = await app.inject({
    method: "POST",
    url: `/api/workflows/${inputWorkflowId}/dry-run`,
    payload: { inputs: {} }
  });
  assert.equal(missingInputResponse.statusCode, 400);
  assert.equal(missingInputResponse.json().message, 'Input "Release message" is required');

  const inputDryRunResponse = await app.inject({
    method: "POST",
    url: `/api/workflows/${inputWorkflowId}/dry-run`,
    payload: { inputs: { message: "release candidate" } }
  });
  assert.equal(inputDryRunResponse.statusCode, 200);
  assert.equal(inputDryRunResponse.json().mode, "dry-run");
  assert.equal(inputDryRunResponse.json().steps[1].message, 'Input "Release message" received');
  const dryRunCommandStep = inputDryRunResponse.json().steps.find(
    (step: { nodeId: string }) => step.nodeId === "input-command"
  );
  assert.match(dryRunCommandStep.command, /REPO_CONTROL_INPUT_MESSAGE/);
  assert.equal(dryRunCommandStep.command.includes("release candidate"), false);

  const shellSensitiveValue = "release candidate; echo not-a-command";
  const inputRunResponse = await app.inject({
    method: "POST",
    url: `/api/workflows/${inputWorkflowId}/run`,
    payload: { inputs: { message: shellSensitiveValue } }
  });
  assert.equal(inputRunResponse.statusCode, 200);
  const commandStep = inputRunResponse.json().steps.find(
    (step: { nodeId: string }) => step.nodeId === "input-command"
  );
  assert.equal(commandStep.status, "success");
  assert.equal(commandStep.stdout.trim(), shellSensitiveValue);
  assert.match(commandStep.command, /REPO_CONTROL_INPUT_MESSAGE/);
  assert.equal(commandStep.command.includes(shellSensitiveValue), false);

  const missingWorkflowResponse = await app.inject({
    method: "POST",
    url: "/api/workflows/missing/dry-run"
  });
  assert.equal(missingWorkflowResponse.statusCode, 404);

});

async function createRepository(repositoryPath: string): Promise<void> {
  await fs.mkdir(repositoryPath, { recursive: true });
  await execFileAsync("git", ["init", "--initial-branch=main"], { cwd: repositoryPath });
  await execFileAsync("git", ["config", "user.name", "Repo Control Tests"], { cwd: repositoryPath });
  await execFileAsync("git", ["config", "user.email", "tests@repo-control.local"], { cwd: repositoryPath });
  await fs.writeFile(path.join(repositoryPath, "README.md"), "# fixture\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: repositoryPath });
  await execFileAsync("git", ["commit", "-m", "Initial fixture"], { cwd: repositoryPath });
}
