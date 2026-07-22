import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createServer } from "./server.js";

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

  const missingWorkflowResponse = await app.inject({
    method: "POST",
    url: "/api/workflows/missing/dry-run"
  });
  assert.equal(missingWorkflowResponse.statusCode, 404);

});
