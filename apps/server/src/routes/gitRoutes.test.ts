import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import Fastify from "fastify";
import { runProjectCommand } from "../lib/commandRunner.js";
import { registerGitRoutes } from "./gitRoutes.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

test("Git routes run real actions and answer 409 when a checkout would lose local changes", async (context) => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-git-routes-"));
  const repositoryPath = path.join(temporaryRoot, "alpha");
  const app = Fastify();
  const resolvedIds: string[] = [];

  context.after(async () => {
    await app.close();
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  });

  await fs.mkdir(repositoryPath);
  await git(repositoryPath, "init", "-b", "main");
  await git(repositoryPath, "config", "user.email", "tests@repo-control.local");
  await git(repositoryPath, "config", "user.name", "repo-control tests");
  await git(repositoryPath, "config", "commit.gpgsign", "false");
  await fs.writeFile(path.join(repositoryPath, "README.md"), "# alpha\n", "utf8");

  await registerGitRoutes(app, {
    getActiveRootPath: () => temporaryRoot,
    setActiveRootPath: () => undefined,
    resolveProjectPath: async (id) => {
      resolvedIds.push(id);
      return repositoryPath;
    },
    runProjectCommand
  });

  const stage = await app.inject({ method: "POST", url: "/api/projects/alpha-id/git/stage-all" });
  assert.equal(stage.statusCode, 200);
  assert.equal(stage.json().ok, true);

  const commit = await app.inject({ method: "POST", url: "/api/projects/alpha-id/git/commit", payload: { message: "Initial commit" } });
  assert.equal(commit.json().ok, true);
  assert.equal(await git(repositoryPath, "log", "-1", "--format=%s"), "Initial commit");

  const branch = await app.inject({ method: "POST", url: "/api/projects/alpha-id/git/branch", payload: { branch: "feature/tools" } });
  assert.equal(branch.statusCode, 200);
  assert.equal(await git(repositoryPath, "branch", "--show-current"), "feature/tools");

  await fs.writeFile(path.join(repositoryPath, "README.md"), "# alpha, edited\n", "utf8");
  const blocked = await app.inject({ method: "POST", url: "/api/projects/alpha-id/git/checkout", payload: { branch: "main" } });
  assert.equal(blocked.statusCode, 409);
  assert.deepEqual(blocked.json(), { ok: false, message: "Checkout blocked: commit, stash, or discard local changes first." });
  assert.equal(await git(repositoryPath, "branch", "--show-current"), "feature/tools", "a blocked checkout leaves the branch alone");

  const stash = await app.inject({ method: "POST", url: "/api/projects/alpha-id/git/stash", payload: { message: "wip" } });
  assert.equal(stash.json().ok, true);
  const checkout = await app.inject({ method: "POST", url: "/api/projects/alpha-id/git/checkout", payload: { branch: "main" } });
  assert.equal(checkout.statusCode, 200);
  assert.equal(await git(repositoryPath, "branch", "--show-current"), "main");

  assert.ok(resolvedIds.every((id) => id === "alpha-id"), "every route resolves the project through the resolver");
});
