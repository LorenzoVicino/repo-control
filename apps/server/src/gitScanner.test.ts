import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { readProjectSummary, scanProjects } from "./gitScanner.js";

const execFileAsync = promisify(execFile);

async function runGit(repositoryPath: string, args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd: repositoryPath });
}

async function createRepository(repositoryPath: string, withCompose = false): Promise<void> {
  await fs.mkdir(repositoryPath, { recursive: true });
  await runGit(repositoryPath, ["init", "--initial-branch=main"]);
  await runGit(repositoryPath, ["config", "user.name", "Repo Control Tests"]);
  await runGit(repositoryPath, ["config", "user.email", "tests@repo-control.local"]);
  await fs.writeFile(path.join(repositoryPath, "README.md"), "# fixture\n", "utf8");

  if (withCompose) {
    await fs.writeFile(path.join(repositoryPath, "compose.yaml"), "services: {}\n", "utf8");
  }

  await runGit(repositoryPath, ["add", "."]);
  await runGit(repositoryPath, ["commit", "-m", "Initial fixture"]);
}

test("scans nested repositories and reports their working tree state", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-scanner-test-"));
  const alphaPath = path.join(temporaryRoot, "group", "alpha");
  const betaPath = path.join(temporaryRoot, "beta");
  const ignoredPath = path.join(temporaryRoot, "node_modules", "ignored");
  const invalidPath = path.join(temporaryRoot, "invalid");

  try {
    await createRepository(alphaPath, true);
    await createRepository(betaPath);
    await createRepository(ignoredPath);
    await fs.mkdir(path.join(invalidPath, ".git"), { recursive: true });

    await fs.appendFile(path.join(alphaPath, "README.md"), "modified\n", "utf8");
    await fs.writeFile(path.join(alphaPath, "staged.txt"), "staged\n", "utf8");
    await runGit(alphaPath, ["add", "staged.txt"]);
    await fs.writeFile(path.join(alphaPath, "untracked.txt"), "untracked\n", "utf8");

    const projects = await scanProjects(temporaryRoot);

    assert.deepEqual(projects.map((project) => project.name), ["alpha", "beta"]);
    const alpha = projects[0];
    assert.ok(alpha);
    assert.equal(alpha.id, Buffer.from(path.join("group", "alpha")).toString("base64url"));
    assert.equal(alpha.branch, "main");
    assert.equal(alpha.isClean, false);
    assert.equal(alpha.staged, 1);
    assert.equal(alpha.modified, 1);
    assert.equal(alpha.untracked, 1);
    assert.equal(alpha.hasDockerCompose, true);
    assert.equal(alpha.lastCommit?.message, "Initial fixture");

    assert.equal(await readProjectSummary(invalidPath, temporaryRoot), null);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("returns an empty result for a workspace without repositories", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-empty-scanner-test-"));

  try {
    assert.deepEqual(await scanProjects(temporaryRoot), []);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("stops a project scan that has already been cancelled", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-cancelled-scanner-test-"));
  const controller = new AbortController();
  controller.abort(new Error("test cancellation"));

  try {
    assert.deepEqual(await scanProjects(temporaryRoot, { signal: controller.signal }), []);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
