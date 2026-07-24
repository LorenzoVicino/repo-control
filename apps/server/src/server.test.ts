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

  const disconnectedWorkflowResponse = await app.inject({
    method: "POST",
    url: "/api/workflows",
    payload: {
      name: "Disconnected workflow",
      description: "",
      active: true,
      nodes: [
        {
          id: "disconnected-trigger",
          type: "trigger.manual",
          name: "Start",
          position: { x: 0, y: 0 },
          config: {}
        },
        {
          id: "disconnected-fetch",
          type: "git.fetch",
          name: "Fetch",
          position: { x: 200, y: 0 },
          config: {}
        }
      ],
      edges: []
    }
  });
  const disconnectedRunResponse = await app.inject({
    method: "POST",
    url: `/api/workflows/${disconnectedWorkflowResponse.json().id}/run`,
    payload: { inputs: {} }
  });
  assert.equal(disconnectedRunResponse.statusCode, 400);
  assert.match(disconnectedRunResponse.json().message, /disconnected/);

  const failFastWorkflowResponse = await app.inject({
    method: "POST",
    url: "/api/workflows",
    payload: {
      name: "Fail fast workflow",
      description: "",
      active: true,
      nodes: [
        {
          id: "fail-fast-trigger",
          type: "trigger.manual",
          name: "Start",
          position: { x: 0, y: 0 },
          config: {}
        },
        {
          id: "fail-fast-repositories",
          type: "repository.select",
          name: "Repositories",
          position: { x: 200, y: 0 },
          config: { mode: "all", projectIds: [] }
        },
        {
          id: "fail-fast-command",
          type: "terminal.command",
          name: "Expected failure",
          position: { x: 400, y: 0 },
          config: { command: "node -e \"process.exit(7)\"" }
        },
        {
          id: "must-not-run",
          type: "terminal.command",
          name: "Must not run",
          position: { x: 600, y: 0 },
          config: { command: "node -e \"console.log('should not run')\"" }
        },
        {
          id: "fail-fast-summary",
          type: "output.summary",
          name: "Summary",
          position: { x: 800, y: 0 },
          config: {}
        }
      ],
      edges: [
        { id: "fail-fast-1", source: "fail-fast-trigger", target: "fail-fast-repositories" },
        { id: "fail-fast-2", source: "fail-fast-repositories", target: "fail-fast-command" },
        { id: "fail-fast-3", source: "fail-fast-command", target: "must-not-run" },
        { id: "fail-fast-4", source: "must-not-run", target: "fail-fast-summary" }
      ]
    }
  });
  const failFastRunResponse = await app.inject({
    method: "POST",
    url: `/api/workflows/${failFastWorkflowResponse.json().id}/run`,
    payload: { inputs: {} }
  });
  assert.equal(failFastRunResponse.statusCode, 200);
  assert.equal(failFastRunResponse.json().status, "failed");
  assert.equal(
    failFastRunResponse.json().steps.find((step: { nodeId: string }) => step.nodeId === "must-not-run").status,
    "skipped"
  );
  assert.equal(
    failFastRunResponse.json().steps.find((step: { nodeId: string }) => step.nodeId === "must-not-run").message,
    "Skipped because a previous step failed"
  );

  const warningWorkflowResponse = await app.inject({
    method: "POST",
    url: "/api/workflows",
    payload: {
      name: "Warning workflow",
      description: "",
      active: true,
      nodes: [
        {
          id: "warning-trigger",
          type: "trigger.manual",
          name: "Start",
          position: { x: 0, y: 0 },
          config: {}
        },
        {
          id: "warning-repositories",
          type: "repository.select",
          name: "Repositories",
          position: { x: 200, y: 0 },
          config: { mode: "all", projectIds: [] }
        },
        {
          id: "warning-docker",
          type: "docker.up",
          name: "Docker up",
          position: { x: 400, y: 0 },
          config: {}
        }
      ],
      edges: [
        { id: "warning-1", source: "warning-trigger", target: "warning-repositories" },
        { id: "warning-2", source: "warning-repositories", target: "warning-docker" }
      ]
    }
  });
  const warningRunResponse = await app.inject({
    method: "POST",
    url: `/api/workflows/${warningWorkflowResponse.json().id}/run`,
    payload: { inputs: {} }
  });
  assert.equal(warningRunResponse.statusCode, 200);
  assert.equal(warningRunResponse.json().status, "warning");

  const concurrentWorkflowPayload = (name: string) => ({
    name,
    description: "",
    active: false,
    nodes: [{
      id: `${name}-trigger`,
      type: "trigger.manual",
      name: "Start",
      position: { x: 0, y: 0 },
      config: {}
    }],
    edges: []
  });
  const concurrentCreateResponses = await Promise.all([
    app.inject({
      method: "POST",
      url: "/api/workflows",
      payload: concurrentWorkflowPayload("Concurrent A")
    }),
    app.inject({
      method: "POST",
      url: "/api/workflows",
      payload: concurrentWorkflowPayload("Concurrent B")
    })
  ]);
  assert.deepEqual(concurrentCreateResponses.map((response) => response.statusCode), [200, 200]);
  const workflowsAfterConcurrentCreates = await app.inject({ method: "GET", url: "/api/workflows" });
  const workflowNames = workflowsAfterConcurrentCreates.json().workflows.map(
    (workflow: { name: string }) => workflow.name
  );
  assert.equal(workflowNames.includes("Concurrent A"), true);
  assert.equal(workflowNames.includes("Concurrent B"), true);

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
