import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { runProjectCommand, runShellCommand, type CommandResult, type CommandRunner } from "../../lib/commandRunner.js";
import { createProjectResolver } from "../../lib/projectResolver.js";
import type { AgentSessionsResponse } from "../agentSessionService.js";
import { createWorkflow } from "../workflowService.js";
import type { WorkflowDraft } from "../workflow/types.js";
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

const unused = async (): Promise<never> => {
  throw new Error("not used");
};

// Tools that act on the workspace or the app as a whole rather than on one repository.
const WORKSPACE_TOOLS = new Set([
  "list_repositories",
  "list_containers",
  "list_workflows",
  "preview_workflow",
  "run_workflow",
  "get_workflow_run",
  "cancel_workflow_run",
  "list_agent_sessions"
]);

test("the catalog names every tool once and marks exactly the repository-changing ones as writes", () => {
  const names = TOOL_CATALOG.map((tool) => tool.name);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(
    TOOL_CATALOG.filter((tool) => tool.effect === "write").map((tool) => tool.name).sort(),
    [
      "cancel_workflow_run",
      "compose_restart_service",
      "compose_stop",
      "compose_up",
      "git_checkout",
      "git_commit",
      "git_create_branch",
      "git_fetch",
      "git_pull",
      "git_push",
      "run_workflow"
    ]
  );
  for (const tool of TOOL_CATALOG) {
    assert.match(tool.name, /^[a-z][a-z_]*$/, `${tool.name} is a valid MCP tool name`);
    assert.ok(tool.description.length > 40, `${tool.name} explains itself to a model`);
    assert.ok(WORKSPACE_TOOLS.has(tool.name) || "repository" in tool.inputShape, `${tool.name} is scoped to one repository`);
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
  const toolkit = createToolkit({ ...resolver, runProjectCommand, runShellCommand });

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
    runShellCommand: unused,
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
    runProjectCommand: unused,
    runShellCommand: unused,
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

function commandResult(command: string, stdout: string, ok = true): CommandResult {
  return { ok, command, exitCode: ok ? 0 : 1, stdout, stderr: "", output: stdout, durationMs: 1 };
}

test("Compose tools only act on repositories with a Compose file and pass service names as plain arguments", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-tools-docker-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await createRepository(root, "shop", { "compose.yml": "services:\n  web:\n    image: nginx\n  db:\n    image: postgres\n" });
  await createRepository(root, "docs", { "index.md": "# docs\n" });

  const dockerCalls: string[][] = [];
  const fakeRunner: CommandRunner = async (cwd, command, args, timeoutMs, options) => {
    if (command !== "docker") return runProjectCommand(cwd, command, args, timeoutMs, options);
    dockerCalls.push(args);
    if (args.join(" ") === "compose config --services") return commandResult("docker compose config", "web\ndb\n");
    if (args[1] === "ps") {
      return commandResult(
        "docker compose ps",
        JSON.stringify({ ID: "abc123", Name: "shop-web-1", Project: "shop", Service: "web", Image: "nginx", State: "running", Status: "Up 2 minutes", Health: "healthy", Publishers: [{ URL: "0.0.0.0", TargetPort: 80, PublishedPort: 8080, Protocol: "tcp" }] })
      );
    }
    if (args[1] === "logs") return commandResult("docker compose logs", "web-1  | listening on :80\n");
    return commandResult(`docker ${args.join(" ")}`, "done\n");
  };
  const toolkit = createToolkit({ ...createProjectResolver(root), runProjectCommand: fakeRunner, runShellCommand: unused });

  const status = await toolkit.run("compose_status", { repository: "shop" });
  assert.equal(status.isError, false);
  assert.match(text(status), /- web: running \(Up 2 minutes\), healthy, ports .*8080/);
  assert.match(text(status), /- db: /, "configured services that are not running are listed too");

  const logs = await toolkit.run("compose_logs", { repository: "shop", service: "web", tail: 50 });
  assert.match(text(logs), /last 50 lines of web:\nweb-1 {2}\| listening on :80/);

  const up = await toolkit.run("compose_up", { repository: "shop", build: true });
  assert.match(text(up), /^docker compose up -d --build in shop succeeded\./);
  await toolkit.run("compose_restart_service", { repository: "shop", service: "db" });
  await toolkit.run("compose_stop", { repository: "shop" });
  assert.deepEqual(dockerCalls.slice(-3), [["compose", "up", "-d", "--build"], ["compose", "restart", "db"], ["compose", "stop"]]);

  const noCompose = await toolkit.run("compose_up", { repository: "docs" });
  assert.deepEqual(noCompose, { isError: true, text: "docs has no Docker Compose file (compose.yml or docker-compose.yml)." });

  const optionLike = await toolkit.run("compose_logs", { repository: "shop", service: "--since=1h" });
  assert.match(text(optionLike), /^Invalid input for compose_logs: service: Invalid Compose service name/);
  assert.equal(dockerCalls.filter((args) => args[1] === "up").length, 1, "refused calls never reach docker");
});

function workflowDraft(name: string, command: string, withInput = false): WorkflowDraft {
  const nodes = [
    { id: "trigger", type: "trigger.manual", name: "Start", position: { x: 0, y: 0 }, config: {} },
    ...(withInput
      ? [{ id: "message", type: "input.text", name: "Message", position: { x: 100, y: 0 }, config: { key: "message", label: "Message", required: true, defaultValue: "" } }]
      : []),
    { id: "repositories", type: "repository.select", name: "Repositories", position: { x: 200, y: 0 }, config: { mode: "all", projectIds: [] } },
    { id: "command", type: "terminal.command", name: "Say hello", position: { x: 400, y: 0 }, config: { command } }
  ];
  const chain = nodes.map((node) => node.id);
  return {
    name,
    description: "Greets every repository",
    nodes,
    edges: chain.slice(1).map((target, index) => ({ id: `edge-${index}`, source: chain[index], target }))
  };
}

test("workflow tools find, preview, run and follow saved workflows but cannot author them", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-tools-workflows-"));
  const previousConfig = process.env.REPO_CONTROL_CONFIG_DIR;
  process.env.REPO_CONTROL_CONFIG_DIR = path.join(root, "config");
  context.after(async () => {
    if (previousConfig === undefined) delete process.env.REPO_CONTROL_CONFIG_DIR;
    else process.env.REPO_CONTROL_CONFIG_DIR = previousConfig;
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  const workspace = path.join(root, "workspace");
  await createRepository(workspace, "atlas-api", { "README.md": "# atlas\n" });
  const toolkit = createToolkit({ ...createProjectResolver(workspace), runProjectCommand, runShellCommand });

  // A fresh config starts with the built-in "Fetch & pull favorites" workflow.
  assert.match(text(await toolkit.run("list_workflows", {})), /^1 workflow\.\n- Fetch & pull favorites/);
  assert.ok(!TOOL_CATALOG.some((tool) => /^(create|update|delete|save)_workflow/.test(tool.name)), "workflows hold shell commands, so the agent cannot write one");

  const greet = await createWorkflow(workflowDraft("Greet", "echo hello-from-workflow"));
  await createWorkflow(workflowDraft("Announce", "echo {{inputs.message}}", true));

  const listed = await toolkit.run("list_workflows", {});
  assert.match(text(listed), /^3 workflows\./);
  assert.match(text(listed), /- Greet \(id .+\): Greets every repository\n {2}steps: Repositories → Say hello/);
  assert.match(text(listed), /inputs: message \(required\)/);

  const preview = await toolkit.run("preview_workflow", { workflow: "greet" });
  assert.equal(preview.isError, false);
  assert.match(text(preview), /^Preview .+ of "Greet": /);
  assert.match(text(preview), /\[atlas-api\] `echo hello-from-workflow`/);

  const missingInput = await toolkit.run("run_workflow", { workflow: "Announce" });
  assert.equal(missingInput.isError, true);
  assert.match(text(missingInput), /message/i);

  const unknown = await toolkit.run("run_workflow", { workflow: "Deploy" });
  assert.deepEqual(unknown, { isError: true, text: 'No workflow called "Deploy". Saved workflows: Fetch & pull favorites, Greet, Announce.' });

  const started = await toolkit.run("run_workflow", { workflow: greet.id });
  assert.equal(started.isError, false);
  const runId = (started as { data: { runId: string } }).data.runId;

  let followed = await toolkit.run("get_workflow_run", { runId });
  for (let attempt = 0; attempt < 300 && /: (pending|running)\./.test(text(followed)); attempt += 1) {
    await delay(25);
    followed = await toolkit.run("get_workflow_run", { runId });
  }
  assert.match(text(followed), /^Run .+ of "Greet": success\. 1 repository, 1 command\. Steps: 3 succeeded, 0 failed/);
  assert.match(text(await toolkit.run("get_workflow_run", {})), new RegExp(`^Run ${runId} `), "without an id it reads the latest run");

  const notActive = await toolkit.run("cancel_workflow_run", { runId });
  assert.deepEqual(notActive, { isError: true, text: `Run ${runId} is not in progress (status success).` });
});

test("agent-session search can be narrowed to one repository", async () => {
  const project = (name: string) => ({ id: name, name, path: `/workspace/${name}` }) as never;
  const session = (projectId: string, title: string) => ({
    id: `${projectId}-1`,
    provider: "claude" as const,
    providerLabel: "Claude Code",
    projectId,
    projectName: projectId,
    projectPath: `/workspace/${projectId}`,
    title,
    preview: null,
    branch: "main",
    startedAt: "2026-11-01T10:00:00.000Z",
    updatedAt: "2026-11-02T09:30:00.000Z",
    match: { field: "content" as const, snippet: "fixed the flaky login test" }
  });
  let searched = "";
  const toolkit = createToolkit({
    getActiveRootPath: () => "/workspace",
    resolveProjectPath: async (id) => `/workspace/${id}`,
    runProjectCommand: unused,
    runShellCommand: unused,
    scan: async () => [project("atlas-api"), project("docs")],
    scanAgentSessions: async (_root, _projects, options): Promise<AgentSessionsResponse> => {
      searched = options?.searchTerm ?? "";
      return {
        root: "/workspace",
        agents: [{ id: "claude", label: "Claude Code", installed: true, used: true, command: "claude", sessionCount: 2 }],
        sessions: [session("atlas-api", "Login flow"), session("docs", "Docs refresh")],
        scannedAt: "2026-11-02T10:00:00.000Z",
        warnings: []
      };
    }
  });

  const result = await toolkit.run("list_agent_sessions", { repository: "atlas-api", search: "login" });
  assert.equal(searched, "login");
  assert.equal(
    text(result),
    '1 session in atlas-api matching "login".\n- Claude Code in atlas-api on main, 2026-11-02 09:30: Login flow\n  "fixed the flaky login test"'
  );
  assert.ok(!JSON.stringify(result).includes("/workspace/"), "session data carries relative paths only");
});
