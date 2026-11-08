import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { runProjectCommand } from "../../lib/commandRunner.js";
import { createProjectResolver } from "../../lib/projectResolver.js";
import { createToolkit, TOOL_CATALOG, type ToolResult } from "./index.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

async function createRepository(root: string, relativePath: string, files: Record<string, string>): Promise<string> {
  const repositoryPath = path.join(root, relativePath);
  await fs.mkdir(repositoryPath, { recursive: true });
  await git(repositoryPath, "init", "-b", "main");
  await git(repositoryPath, "config", "user.email", "tests@repo-control.local");
  await git(repositoryPath, "config", "user.name", "repo-control tests");
  await git(repositoryPath, "config", "commit.gpgsign", "false");
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(path.join(repositoryPath, name), content, "utf8");
  }
  await git(repositoryPath, "add", "-A");
  await git(repositoryPath, "commit", "-m", `Initial ${path.basename(relativePath)}`);
  return repositoryPath;
}

function text(result: ToolResult): string {
  return result.text;
}

test("the catalog names every tool once and marks exactly the repository-changing ones as writes", () => {
  const names = TOOL_CATALOG.map((tool) => tool.name);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(
    TOOL_CATALOG.filter((tool) => tool.effect === "write").map((tool) => tool.name).sort(),
    ["git_checkout", "git_commit", "git_create_branch", "git_fetch", "git_pull", "git_push"]
  );
  for (const tool of TOOL_CATALOG) {
    assert.match(tool.name, /^[a-z][a-z_]*$/, `${tool.name} is a valid MCP tool name`);
    assert.ok(tool.description.length > 40, `${tool.name} explains itself to a model`);
    assert.ok("repository" in tool.inputShape || tool.name === "list_repositories", `${tool.name} is scoped to one repository`);
  }
});

test("tools read and change a real workspace through names, paths and the project boundary", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-tools-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));

  const atlas = await createRepository(root, "atlas-api", { "README.md": "# atlas\n", "server.ts": "export const port = 3000;\n" });
  await createRepository(root, "docs", { "index.md": "# docs\n" });
  await createRepository(root, "apps/shared", { "a.txt": "a\n" });
  await createRepository(root, "libs/shared", { "b.txt": "b\n" });
  await fs.writeFile(path.join(atlas, "server.ts"), "export const port = 4000;\n", "utf8");
  await fs.writeFile(path.join(atlas, "notes.md"), "todo\n", "utf8");

  const resolver = createProjectResolver(root);
  const toolkit = createToolkit({ ...resolver, runProjectCommand });

  const all = await toolkit.run("list_repositories", {});
  assert.equal(all.isError, false);
  assert.match(text(all), /^4 of 4 repositories\./);
  assert.ok(!text(all).includes(root), "results use workspace-relative paths, not absolute ones");

  const dirty = await toolkit.run("list_repositories", { state: "needs-attention" });
  assert.match(text(dirty), /^1 of 4 repositories \(needs-attention\)\.\n- atlas-api \(atlas-api\) on main, no upstream: 1 modified, 1 untracked$/);

  const shared = await toolkit.run("list_repositories", { query: "SHARED" });
  assert.match(text(shared), /^2 of 4 repositories\./);

  const inspected = await toolkit.run("get_repository", { repository: "atlas-api" });
  assert.equal(inspected.isError, false);
  assert.match(text(inspected), /Unstaged \(2\):/);
  assert.match(text(inspected), /server\.ts/);
  assert.match(text(inspected), /Initial atlas-api/);

  const byPath = await toolkit.run("get_repository", { repository: "libs/shared/" });
  assert.match(text(byPath), /^shared on main/);

  const ambiguous = await toolkit.run("get_repository", { repository: "shared" });
  assert.deepEqual(ambiguous, {
    isError: true,
    text: '"shared" matches 2 repositories: apps/shared, libs/shared. Use the relative path instead.'
  });

  const unknown = await toolkit.run("git_log", { repository: "billing" });
  assert.equal(unknown.isError, true);
  assert.match(text(unknown), /No repository called "billing"\. Known repositories: .*atlas-api.*docs/);

  const outside = await toolkit.run("get_repository", { repository: Buffer.from("../outside").toString("base64url") });
  assert.equal(outside.isError, true, "an ID for a path outside the workspace is not a discovered repository");

  const summary = await toolkit.run("git_diff", { repository: "atlas-api" });
  assert.match(text(summary), /Staged:\n {2}none/);
  assert.match(text(summary), /server\.ts \| 2/);

  const patch = await toolkit.run("git_diff", { repository: "atlas-api", path: "server.ts" });
  assert.match(text(patch), /\+export const port = 4000;/);

  const log = await toolkit.run("git_log", { repository: "atlas-api", limit: 5 });
  assert.match(text(log), /Initial atlas-api/);

  const branches = await toolkit.run("list_branches", { repository: "atlas-api" });
  assert.match(text(branches), /\* main/);

  const blocked = await toolkit.run("git_create_branch", { repository: "atlas-api", branch: "feature/tools" });
  assert.equal(blocked.isError, true);
  assert.match(text(blocked), /^Creating feature\/tools in atlas-api was refused: Checkout blocked/);

  const commit = await toolkit.run("git_commit", { repository: "atlas-api", message: "Move to port 4000", stageAll: true });
  assert.equal(commit.isError, false);
  assert.match(text(commit), /^git commit in atlas-api succeeded\./);
  assert.equal(await git(atlas, "log", "-1", "--format=%s"), "Move to port 4000");

  const afterWrite = await toolkit.run("list_repositories", { state: "needs-attention" });
  assert.match(text(afterWrite), /^0 of 4 repositories/, "a write invalidates the cached scan");

  const created = await toolkit.run("git_create_branch", { repository: "atlas-api", branch: "feature/tools" });
  assert.equal(created.isError, false);
  assert.equal(await git(atlas, "branch", "--show-current"), "feature/tools");
});

test("the registry rejects unknown tools, invalid values and unexpected fields before running anything", async () => {
  let scans = 0;
  const toolkit = createToolkit({
    getActiveRootPath: () => "/workspace",
    resolveProjectPath: async () => {
      throw new Error("must not resolve");
    },
    runProjectCommand: async () => {
      throw new Error("must not run");
    },
    scan: async () => {
      scans += 1;
      return [];
    }
  });

  assert.deepEqual(await toolkit.run("rm_rf", {}), { isError: true, text: 'Unknown tool "rm_rf".' });

  const tooMany = await toolkit.run("git_log", { repository: "atlas-api", limit: 500 });
  assert.equal(tooMany.isError, true);
  assert.match(text(tooMany), /^Invalid input for git_log: limit: /);

  const unsafeRef = await toolkit.run("git_checkout", { repository: "atlas-api", branch: "--upload-pack=x" });
  assert.match(text(unsafeRef), /^Invalid input for git_checkout: branch: Invalid branch name/);

  const extra = await toolkit.run("git_pull", { repository: "atlas-api", force: true });
  assert.match(text(extra), /^Invalid input for git_pull: input: Unrecognized key\(s\) in object: 'force'/);

  assert.equal(scans, 0, "invalid calls never touch the workspace");

  const empty = await toolkit.run("get_repository", { repository: "atlas-api" });
  assert.deepEqual(empty, { isError: true, text: 'No repository called "atlas-api": the workspace has no Git repositories.' });
});

test("repository scans are shared across calls for a few seconds and refreshed after that", async () => {
  let scans = 0;
  let clock = 0;
  const toolkit = createToolkit({
    getActiveRootPath: () => "/workspace",
    resolveProjectPath: async () => "/workspace/a",
    runProjectCommand: async () => {
      throw new Error("not used");
    },
    scan: async () => {
      scans += 1;
      return [];
    },
    now: () => clock
  });

  await toolkit.run("list_repositories", {});
  await toolkit.run("list_repositories", { state: "dirty" });
  assert.equal(scans, 1);
  clock = 3_001;
  await toolkit.run("list_repositories", {});
  assert.equal(scans, 2);
});
