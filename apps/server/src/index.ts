import cors from "@fastify/cors";
import Fastify from "fastify";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { simpleGit } from "simple-git";
import type { StatusResult } from "simple-git";
import { z } from "zod";
import { readRunningDockerContainers, stopDockerContainers } from "./docker.js";
import { openNativeFolderPicker } from "./folderPicker.js";
import { scanProjects } from "./gitScanner.js";
import { readPreferences, writePreferences } from "./preferences.js";
import {
  getNpmCommand,
  getTerminalCommand,
  getVSCodeFailureHint,
  getVSCodeLauncherCandidates,
  shouldUseShellForCommand
} from "./runtime.js";

const envSchema = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().default(3747),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("error"),
  REPO_CONTROL_ROOT: z.string().default(process.cwd())
});

const env = envSchema.parse(process.env);
const app = Fastify({
  disableRequestLogging: true,
  logger: {
    level: env.LOG_LEVEL
  }
});
let activeRootPath = resolveRootInput(env.REPO_CONTROL_ROOT);

await app.register(cors, {
  origin: ["http://127.0.0.1:5173", "http://localhost:5173"]
});

app.addHook("onError", async (request, reply, error) => {
  request.log.error(
    {
      err: error,
      method: request.method,
      statusCode: reply.statusCode,
      url: request.url
    },
    "API error"
  );
});

app.get("/api/health", async () => ({
  ok: true,
  root: activeRootPath
}));

app.get("/api/projects", async () => ({
  root: activeRootPath,
  projects: await scanProjects(activeRootPath)
}));

app.get("/api/docker/containers", async () => readRunningDockerContainers(activeRootPath, runProjectCommand));

app.post("/api/docker/containers/stop", async (request) => {
  const body = z
    .object({
      containerIds: z.array(z.string().regex(/^[a-f0-9]{12,64}$/i)).min(1).max(100)
    })
    .parse(request.body);

  return stopDockerContainers(activeRootPath, body.containerIds, runProjectCommand);
});

app.get("/api/preferences", async () => readPreferences());

app.put("/api/preferences", async (request) => {
  const body = z
    .object({
      favoriteProjectIds: z.array(z.string().trim().min(1).max(2048)).max(2000)
    })
    .parse(request.body);

  return writePreferences(body);
});

app.get("/api/app/update-status", async () => readAppUpdateStatus());

app.post("/api/root", async (request, reply) => {
  const body = z.object({ root: z.string().min(1) }).parse(request.body);
  const nextRootPath = resolveRootInput(body.root);
  const stat = await fs.stat(nextRootPath).catch(() => null);

  if (!stat?.isDirectory()) {
    return reply.code(400).send({
      ok: false,
      message: "Root path must be an existing directory"
    });
  }

  activeRootPath = nextRootPath;

  return {
    ok: true,
    root: activeRootPath
  };
});

app.post("/api/folder-picker", async (request, reply) => {
  const body = z.object({ initialPath: z.string().optional() }).parse(request.body ?? {});
  const initialPath = body.initialPath ? resolveRootInput(body.initialPath) : activeRootPath;
  const pickerResult = await openNativeFolderPicker(initialPath, runProjectCommand);

  if (pickerResult.cancelled) {
    return {
      ok: false,
      cancelled: true,
      message: "Folder selection cancelled"
    };
  }

  if (!pickerResult.path) {
    return reply.code(501).send({
      ok: false,
      message: pickerResult.message ?? "No supported folder picker found for this environment"
    });
  }

  const pickedPath = resolveRootInput(pickerResult.path);
  const stat = await fs.stat(pickedPath).catch(() => null);

  if (!stat?.isDirectory()) {
    return reply.code(400).send({
      ok: false,
      message: "Selected path must be an existing directory"
    });
  }

  return {
    ok: true,
    path: pickedPath
  };
});

app.post("/api/app/update", async () => {
  const result = await updateApplication();

  if (result.ok) {
    scheduleServerRestart();
  }

  return {
    ...result,
    restartScheduled: result.ok
  };
});

app.post("/api/projects/:id/open-vscode", async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const projectPath = await resolveProjectPath(params.id);

  return reply.send(await openProjectInVSCode(projectPath));
});

app.post("/api/projects/:id/git/fetch", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const projectPath = await resolveProjectPath(params.id);

  return runProjectCommand(projectPath, "git", ["fetch", "--all", "--prune"]);
});

app.get("/api/projects/:id/git/details", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const projectPath = await resolveProjectPath(params.id);

  return readGitDetails(projectPath);
});

app.get("/api/projects/:id/git/activity", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const query = z
    .object({
      offset: z.coerce.number().int().min(0).max(5000).default(0),
      limit: z.coerce.number().int().min(1).max(30).default(8)
    })
    .parse(request.query);
  const projectPath = await resolveProjectPath(params.id);

  return readGitActivity(projectPath, query.offset, query.limit);
});

app.post("/api/projects/:id/git/pull", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const projectPath = await resolveProjectPath(params.id);

  return runProjectCommand(projectPath, "git", ["pull", "--ff-only"]);
});

app.post("/api/projects/:id/git/stage-all", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const projectPath = await resolveProjectPath(params.id);

  return runProjectCommand(projectPath, "git", ["add", "-A"]);
});

app.post("/api/projects/:id/git/stage", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const body = gitFileActionBodySchema.parse(request.body);
  const projectPath = await resolveProjectPath(params.id);

  return runProjectCommand(projectPath, "git", ["add", "-A", ...getGitPathArgs(body.path, body.previousPath)]);
});

app.post("/api/projects/:id/git/unstage-all", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const projectPath = await resolveProjectPath(params.id);

  return runProjectCommand(projectPath, "git", ["reset"]);
});

app.post("/api/projects/:id/git/unstage", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const body = gitFileActionBodySchema.parse(request.body);
  const projectPath = await resolveProjectPath(params.id);

  return runProjectCommand(projectPath, "git", ["reset", ...getGitPathArgs(body.path, body.previousPath)]);
});

app.post("/api/projects/:id/git/commit", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const body = z.object({ message: z.string().trim().min(1).max(500) }).parse(request.body);
  const projectPath = await resolveProjectPath(params.id);

  return runProjectCommand(projectPath, "git", ["commit", "-m", body.message]);
});

app.post("/api/projects/:id/git/stash", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const body = z.object({ message: z.string().trim().max(200).optional() }).parse(request.body ?? {});
  const projectPath = await resolveProjectPath(params.id);
  const message = body.message || `repo-control stash ${new Date().toISOString()}`;

  return runProjectCommand(projectPath, "git", ["stash", "push", "-u", "-m", message]);
});

app.post("/api/projects/:id/git/stash-pop", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const body = z.object({ ref: gitStashRefSchema }).parse(request.body);
  const projectPath = await resolveProjectPath(params.id);

  return runProjectCommand(projectPath, "git", ["stash", "pop", body.ref]);
});

app.post("/api/projects/:id/git/push", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const projectPath = await resolveProjectPath(params.id);

  return runProjectCommand(projectPath, "git", ["push"], 1000 * 60 * 5);
});

app.post("/api/projects/:id/git/checkout", async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const body = z.object({ branch: gitRefSchema, remote: z.boolean().default(false) }).parse(request.body);
  const projectPath = await resolveProjectPath(params.id);
  const dirtyMessage = await getDirtyCheckoutMessage(projectPath);

  if (dirtyMessage) {
    return reply.code(409).send({
      ok: false,
      message: dirtyMessage
    });
  }

  const normalizedBranch = normalizeRemoteBranch(body.branch);
  const args = body.remote ? ["switch", "--track", normalizedBranch] : ["switch", body.branch];

  return runProjectCommand(projectPath, "git", args);
});

app.post("/api/projects/:id/git/branch", async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const body = z.object({ branch: gitRefSchema }).parse(request.body);
  const projectPath = await resolveProjectPath(params.id);
  const dirtyMessage = await getDirtyCheckoutMessage(projectPath);

  if (dirtyMessage) {
    return reply.code(409).send({
      ok: false,
      message: dirtyMessage
    });
  }

  return runProjectCommand(projectPath, "git", ["switch", "-c", body.branch]);
});

app.post("/api/projects/:id/docker/rebuild", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const projectPath = await resolveProjectPath(params.id);

  await assertComposeProject(projectPath);
  return runProjectCommand(projectPath, "docker", ["compose", "up", "-d", "--build"], 1000 * 60 * 10);
});

app.post("/api/projects/:id/docker/up", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const projectPath = await resolveProjectPath(params.id);

  await assertComposeProject(projectPath);
  return runProjectCommand(projectPath, "docker", ["compose", "up", "-d"], 1000 * 60 * 10);
});

app.post("/api/projects/:id/docker/stop", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const projectPath = await resolveProjectPath(params.id);

  await assertComposeProject(projectPath);
  return runProjectCommand(projectPath, "docker", ["compose", "stop"], 1000 * 60 * 5);
});

app.post("/api/projects/:id/terminal/run", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const body = z.object({ command: z.string().trim().min(1).max(2000) }).parse(request.body);
  const projectPath = await resolveProjectPath(params.id);

  return runShellCommand(projectPath, body.command, 1000 * 60 * 10);
});

const gitRefSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(isSafeGitRef, "Invalid branch name");

const gitFilePathSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine(isSafeGitPath, "Invalid Git file path");

const gitFileActionBodySchema = z.object({
  path: gitFilePathSchema,
  previousPath: gitFilePathSchema.nullish()
});

const gitStashRefSchema = z.string().regex(/^stash@\{\d+\}$/, "Invalid stash reference");

async function resolveProjectPath(id: string): Promise<string> {
  const decodedRelPath = Buffer.from(id, "base64url").toString("utf8");
  const projectPath = path.resolve(activeRootPath, decodedRelPath);
  const relativePath = path.relative(activeRootPath, projectPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Project path is outside configured root");
  }

  await fs.access(path.join(projectPath, ".git"));
  return projectPath;
}

function resolveRootInput(rootInput: string): string {
  if (rootInput === "~") {
    return path.resolve(process.env.HOME ?? process.cwd());
  }

  if (rootInput.startsWith("~/")) {
    return path.resolve(process.env.HOME ?? process.cwd(), rootInput.slice(2));
  }

  return path.resolve(rootInput);
}

async function assertComposeProject(projectPath: string): Promise<void> {
  const composeFiles = ["compose.yml", "compose.yaml", "docker-compose.yml", "docker-compose.yaml"];
  const checks = await Promise.all(
    composeFiles.map(async (fileName) => {
      try {
        await fs.access(path.join(projectPath, fileName));
        return true;
      } catch {
        return false;
      }
    })
  );

  if (!checks.some(Boolean)) {
    throw new Error("No Docker Compose file found for this project");
  }
}

type GitFileStatus = "staged" | "modified" | "deleted" | "renamed" | "untracked" | "conflicted";

type GitFileChange = {
  path: string;
  previousPath: string | null;
  status: GitFileStatus;
  label: string;
};

type GitChangeGroups = {
  staged: GitFileChange[];
  unstaged: GitFileChange[];
};

type GitBranchInfo = {
  name: string;
  current: boolean;
  remote: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
};

type GitDetails = {
  status: {
    current: string;
    detached: boolean;
    isClean: boolean;
    tracking: string | null;
    ahead: number;
    behind: number;
    files: GitChangeGroups;
  };
  branches: {
    current: string;
    local: GitBranchInfo[];
    remote: GitBranchInfo[];
  };
  stashes: GitStashEntry[];
};

type GitStashEntry = {
  ref: string;
  index: number;
  date: string;
  message: string;
};

type GitActivityCommit = {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  refs: string[];
  message: string;
};

type GitActivity = {
  commits: GitActivityCommit[];
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
};

async function readGitDetails(projectPath: string): Promise<GitDetails> {
  const git = simpleGit(projectPath);
  const [status, localBranchesRaw, remoteBranchesRaw, stashListRaw] = await Promise.all([
    git.status(),
    git.raw(["branch", "--format=%(refname:short)|%(HEAD)|%(upstream:short)|%(upstream:track)", "--sort=refname"]),
    git.raw([
      "branch",
      "-r",
      "--format=%(refname:short)|%(HEAD)|%(upstream:short)|%(upstream:track)",
      "--sort=refname"
    ]),
    git.raw(["stash", "list", "--date=iso-strict", "--pretty=format:%gd%x1f%ci%x1f%gs%x1e"]).catch(() => "")
  ]);
  const current = status.current || "(detached)";

  return {
    status: {
      current,
      detached: status.detached,
      isClean: status.isClean(),
      tracking: status.tracking || null,
      ahead: status.ahead,
      behind: status.behind,
      files: getChangeGroups(status)
    },
    branches: {
      current,
      local: parseBranchRows(localBranchesRaw, false, status),
      remote: parseBranchRows(remoteBranchesRaw, true, status)
    },
    stashes: parseGitStashes(stashListRaw)
  };
}

async function readGitActivity(projectPath: string, offset: number, limit: number): Promise<GitActivity> {
  const logOutput = await simpleGit(projectPath)
    .raw([
      "log",
      `--skip=${offset}`,
      `--max-count=${limit + 1}`,
      "--date=iso-strict",
      "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%D%x1f%s%x1e"
    ])
    .catch(() => "");
  const commits = parseGitActivity(logOutput);
  const hasMore = commits.length > limit;

  return {
    commits: commits.slice(0, limit),
    offset,
    limit,
    hasMore,
    nextOffset: hasMore ? offset + limit : null
  };
}

function parseGitActivity(output: string): GitActivityCommit[] {
  return output
    .split("\x1e")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [hash = "", shortHash = "", author = "", date = "", refs = "", message = ""] = row.split("\x1f");

      return {
        hash,
        shortHash,
        author,
        date,
        refs: parseGitRefs(refs),
        message
      };
    })
    .filter((commit) => commit.hash && commit.shortHash);
}

function parseGitRefs(refs: string): string[] {
  return refs
    .split(",")
    .map((ref) => ref.trim())
    .filter(Boolean)
    .map((ref) => ref.replace(/^HEAD -> /, ""))
    .slice(0, 4);
}

function getChangeGroups(status: StatusResult): GitChangeGroups {
  return {
    staged: uniqueGitFileChanges(status.staged.map((filePath) => createGitFileChange(filePath, "staged"))),
    unstaged: uniqueGitFileChanges([
      ...status.modified.map((filePath) => createGitFileChange(filePath, "modified")),
      ...status.deleted.map((filePath) => createGitFileChange(filePath, "deleted")),
      ...status.renamed.map((file) => createGitFileChange(file.to, "renamed", file.from)),
      ...status.not_added.map((filePath) => createGitFileChange(filePath, "untracked")),
      ...status.conflicted.map((filePath) => createGitFileChange(filePath, "conflicted"))
    ])
  };
}

function createGitFileChange(pathName: string, status: GitFileStatus, previousPath: string | null = null): GitFileChange {
  return {
    path: pathName,
    previousPath,
    status,
    label: getGitFileStatusLabel(status)
  };
}

function getGitFileStatusLabel(status: GitFileStatus): string {
  switch (status) {
    case "staged":
      return "staged";
    case "modified":
      return "modified";
    case "deleted":
      return "deleted";
    case "renamed":
      return "renamed";
    case "untracked":
      return "untracked";
    case "conflicted":
      return "conflict";
  }
}

function uniqueGitFileChanges(files: GitFileChange[]): GitFileChange[] {
  const seen = new Set<string>();
  const uniqueFiles: GitFileChange[] = [];

  for (const file of files) {
    const key = `${file.previousPath ?? ""}\x1f${file.path}\x1f${file.status}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueFiles.push(file);
  }

  return uniqueFiles.sort((left, right) => getGitFileDisplayPath(left).localeCompare(getGitFileDisplayPath(right)));
}

function getGitFileDisplayPath(file: GitFileChange): string {
  return file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path;
}

function parseGitStashes(output: string): GitStashEntry[] {
  return output
    .split("\x1e")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [ref = "", date = "", message = ""] = row.split("\x1f");

      return {
        ref,
        index: Number(ref.match(/stash@\{(\d+)\}/)?.[1] ?? 0),
        date,
        message
      };
    })
    .filter((stash) => stash.ref.length > 0);
}

function parseBranchRows(output: string, remote: boolean, status: StatusResult): GitBranchInfo[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", head = "", upstream = "", track = ""] = line.split("|");
      const sync = parseTrack(track);
      const isCurrent = head === "*";

      return {
        name,
        current: isCurrent,
        remote,
        upstream: upstream || null,
        ahead: isCurrent ? status.ahead : sync.ahead,
        behind: isCurrent ? status.behind : sync.behind
      };
    })
    .filter((branch) => branch.name.length > 0 && branch.name !== "origin/HEAD");
}

function parseTrack(track: string): { ahead: number; behind: number } {
  return {
    ahead: Number(track.match(/ahead (\d+)/)?.[1] ?? 0),
    behind: Number(track.match(/behind (\d+)/)?.[1] ?? 0)
  };
}

async function getDirtyCheckoutMessage(projectPath: string): Promise<string | null> {
  const status = await simpleGit(projectPath).status();

  if (status.isClean()) {
    return null;
  }

  return "Checkout blocked: commit, stash, or discard local changes first.";
}

function normalizeRemoteBranch(branch: string): string {
  return branch.replace(/^remotes\//, "");
}

function isSafeGitRef(ref: string): boolean {
  return (
    /^[A-Za-z0-9._/-]+$/.test(ref) &&
    !ref.startsWith("-") &&
    !ref.startsWith("/") &&
    !ref.endsWith("/") &&
    !ref.endsWith(".") &&
    !ref.includes("//") &&
    !ref.includes("..") &&
    !ref.includes("@{") &&
    !ref.endsWith(".lock")
  );
}

function isSafeGitPath(filePath: string): boolean {
  if (
    path.isAbsolute(filePath) ||
    filePath.includes("\0") ||
    filePath.includes("\n") ||
    filePath.includes("\r")
  ) {
    return false;
  }

  const segments = filePath.split(/[\\/]+/);
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function getGitPathArgs(filePath: string, previousPath: string | null | undefined): string[] {
  return ["--", ...[previousPath, filePath].filter((pathArg): pathArg is string => Boolean(pathArg))];
}


type CommandResult = {
  ok: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  output: string;
  durationMs: number;
};

type AppUpdateResult = CommandResult & {
  restartScheduled: boolean;
};

type AppUpdateStatus = {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  checkedAt: string;
  error: string | null;
};

let restartTimer: NodeJS.Timeout | null = null;

function runProjectCommand(
  cwd: string,
  command: string,
  args: string[],
  timeoutMs = 1000 * 60 * 3,
  options: { displayCommand?: string; shell?: boolean } = {}
): Promise<CommandResult> {
  const startedAt = Date.now();
  const displayCommand = options.displayCommand ?? [command, ...args].join(" ");

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: options.shell ?? shouldUseShellForCommand(command)
    });

    let stdout = "";
    let stderr = "";
    let didTimeout = false;

    const timeout = setTimeout(() => {
      didTimeout = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendOutput(stdout, chunk.toString("utf8"));
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendOutput(stderr, chunk.toString("utf8"));
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        ok: false,
        command: displayCommand,
        exitCode: null,
        stdout,
        stderr: appendOutput(stderr, error.message),
        output: [stdout, stderr, error.message].filter(Boolean).join("\n"),
        durationMs: Date.now() - startedAt
      });
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      const timeoutMessage = didTimeout ? `Command timed out after ${timeoutMs}ms` : "";

      resolve({
        ok: exitCode === 0 && !didTimeout,
        command: displayCommand,
        exitCode,
        stdout,
        stderr: appendOutput(stderr, timeoutMessage),
        output: [stdout, stderr, timeoutMessage].filter(Boolean).join("\n"),
        durationMs: Date.now() - startedAt
      });
    });
  });
}

async function readAppUpdateStatus(): Promise<AppUpdateStatus> {
  const appRootPath = path.resolve(process.cwd());
  const currentVersion = await readLocalAppVersion(appRootPath);
  const checkedAt = new Date().toISOString();

  try {
    await fs.access(path.join(appRootPath, ".git"));
  } catch {
    return {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      checkedAt,
      error: "repo-control is not running from a Git checkout"
    };
  }

  const tags = await runProjectCommand(appRootPath, "git", ["ls-remote", "--tags", "--refs", "origin"], 1000 * 20);

  if (!tags.ok) {
    return {
      currentVersion,
      latestVersion: null,
      updateAvailable: false,
      checkedAt,
      error: tags.output || "Unable to check remote releases"
    };
  }

  const latestVersion = getLatestReleaseVersion(tags.stdout);

  return {
    currentVersion,
    latestVersion,
    updateAvailable: latestVersion ? compareVersions(latestVersion, currentVersion) > 0 : false,
    checkedAt,
    error: latestVersion ? null : "No semver release tags found on origin"
  };
}

async function readLocalAppVersion(appRootPath: string): Promise<string> {
  const packageJson = await fs.readFile(path.join(appRootPath, "package.json"), "utf8").catch(() => null);

  if (!packageJson) {
    return "0.0.0";
  }

  try {
    const parsedPackageJson = JSON.parse(packageJson) as { version?: unknown };
    return typeof parsedPackageJson.version === "string" ? parsedPackageJson.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function getLatestReleaseVersion(lsRemoteOutput: string): string | null {
  const versions = lsRemoteOutput
    .split("\n")
    .map((line) => line.match(/refs\/tags\/v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/)?.[1] ?? null)
    .filter((version): version is string => version !== null)
    .sort(compareVersions);

  return versions[versions.length - 1] ?? null;
}

function compareVersions(leftVersion: string, rightVersion: string): number {
  const left = parseVersion(leftVersion);
  const right = parseVersion(rightVersion);

  for (let index = 0; index < 3; index += 1) {
    const difference = left.numbers[index] - right.numbers[index];

    if (difference !== 0) {
      return difference;
    }
  }

  if (left.prerelease === right.prerelease) {
    return 0;
  }

  if (!left.prerelease) {
    return 1;
  }

  if (!right.prerelease) {
    return -1;
  }

  return left.prerelease.localeCompare(right.prerelease);
}

function parseVersion(version: string): { numbers: [number, number, number]; prerelease: string } {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/);

  return {
    numbers: [
      Number(match?.[1] ?? 0),
      Number(match?.[2] ?? 0),
      Number(match?.[3] ?? 0)
    ],
    prerelease: match?.[4] ?? ""
  };
}

async function updateApplication(): Promise<AppUpdateResult> {
  const appRootPath = path.resolve(process.cwd());
  const gitDir = path.join(appRootPath, ".git");

  try {
    await fs.access(gitDir);
  } catch {
    return {
      ok: false,
      command: "update repo-control",
      exitCode: null,
      stdout: "",
      stderr: "repo-control is not running from a Git checkout",
      output: "repo-control is not running from a Git checkout",
      durationMs: 0,
      restartScheduled: false
    };
  }

  const updateStatus = await readAppUpdateStatus();

  if (!updateStatus.updateAvailable) {
    const message = updateStatus.error
      ? `Update unavailable: ${updateStatus.error}`
      : `No newer release available. Current version: v${updateStatus.currentVersion}.`;

    return {
      ok: false,
      command: "update repo-control",
      exitCode: 0,
      stdout: "",
      stderr: message,
      output: message,
      durationMs: 0,
      restartScheduled: false
    };
  }

  const status = await runProjectCommand(appRootPath, "git", ["status", "--porcelain"]);

  if (!status.ok) {
    return combineUpdateResults([status], false);
  }

  if (status.stdout.trim()) {
    return {
      ok: false,
      command: "update repo-control",
      exitCode: 1,
      stdout: status.stdout,
      stderr: "Update blocked because repo-control has local changes.",
      output: [
        "Update blocked because repo-control has local changes.",
        "Commit, stash, or discard local changes before updating.",
        "",
        status.stdout.trim()
      ].join("\n"),
      durationMs: status.durationMs,
      restartScheduled: false
    };
  }

  const steps: CommandResult[] = [];
  const commands: Array<{ command: string; args: string[]; timeoutMs?: number }> = [
    { command: "git", args: ["fetch", "--tags", "origin"] },
    { command: "git", args: ["pull", "--ff-only"] },
    { command: getNpmCommand(), args: ["install"], timeoutMs: 1000 * 60 * 10 }
  ];

  for (const step of commands) {
    const result = await runProjectCommand(appRootPath, step.command, step.args, step.timeoutMs ?? 1000 * 60 * 3);
    steps.push(result);

    if (!result.ok) {
      break;
    }
  }

  return combineUpdateResults(steps, steps.every((step) => step.ok));
}

function combineUpdateResults(steps: CommandResult[], restartScheduled: boolean): AppUpdateResult {
  const ok = steps.length > 0 && steps.every((step) => step.ok);
  const lastStep = steps[steps.length - 1];
  const output = steps
    .map((step) => [`$ ${step.command}`, step.output || "Done"].join("\n"))
    .join("\n\n");

  return {
    ok,
    command: "update repo-control",
    exitCode: lastStep?.exitCode ?? null,
    stdout: steps.map((step) => step.stdout).filter(Boolean).join("\n"),
    stderr: steps.map((step) => step.stderr).filter(Boolean).join("\n"),
    output,
    durationMs: steps.reduce((total, step) => total + step.durationMs, 0),
    restartScheduled
  };
}

function scheduleServerRestart(): void {
  if (restartTimer) {
    return;
  }

  restartTimer = setTimeout(() => {
    app.log.info("Restarting repo-control after update");
    process.exit(0);
  }, 1200);
  restartTimer.unref();
}

function runShellCommand(cwd: string, commandLine: string, timeoutMs: number): Promise<CommandResult> {
  const startedAt = Date.now();
  const terminalCommand = getTerminalCommand(commandLine);

  return new Promise((resolve) => {
    const child = spawn(terminalCommand.command, terminalCommand.args, {
      cwd,
      shell: terminalCommand.shell ?? shouldUseShellForCommand(terminalCommand.command),
      env: {
        ...process.env,
        FORCE_COLOR: "1",
        TERM: process.env.TERM ?? "xterm-256color"
      }
    });

    let stdout = "";
    let stderr = "";
    let didTimeout = false;

    const timeout = setTimeout(() => {
      didTimeout = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendOutput(stdout, chunk.toString("utf8"));
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendOutput(stderr, chunk.toString("utf8"));
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        ok: false,
        command: terminalCommand.displayCommand ?? commandLine,
        exitCode: null,
        stdout,
        stderr: appendOutput(stderr, error.message),
        output: [stdout, stderr, error.message].filter(Boolean).join("\n"),
        durationMs: Date.now() - startedAt
      });
    });

    child.on("close", (exitCode) => {
      clearTimeout(timeout);
      const timeoutMessage = didTimeout ? `Command timed out after ${timeoutMs}ms` : "";

      resolve({
        ok: exitCode === 0 && !didTimeout,
        command: terminalCommand.displayCommand ?? commandLine,
        exitCode,
        stdout,
        stderr: appendOutput(stderr, timeoutMessage),
        output: [stdout, stderr, timeoutMessage].filter(Boolean).join("\n"),
        durationMs: Date.now() - startedAt
      });
    });
  });
}

async function openProjectInVSCode(projectPath: string): Promise<CommandResult> {
  const candidates = await getVSCodeLauncherCandidates();
  const failures: string[] = [];

  for (const candidate of candidates) {
    const result = await runProjectCommand(
      projectPath,
      candidate.command,
      [...candidate.args, projectPath],
      1000 * 20,
      { displayCommand: [candidate.command, ...candidate.args, projectPath].join(" "), shell: candidate.shell }
    );

    if (result.ok) {
      return result;
    }

    failures.push(`${result.command}\n${result.output || "No output"}`);
  }

  return {
    ok: false,
    command: "open VS Code",
    exitCode: null,
    stdout: "",
    stderr: failures.join("\n\n"),
    output: [
      "Unable to launch VS Code from this Node process.",
      await getVSCodeFailureHint(),
      "",
      "Tried:",
      ...failures.map((failure) => `- ${failure.split("\n")[0]}`)
    ].join("\n"),
    durationMs: 0
  };
}

function appendOutput(current: string, next: string): string {
  const maxLength = 30_000;
  const combined = current + next;

  return combined.length > maxLength ? combined.slice(combined.length - maxLength) : combined;
}

const STARTUP_BANNER_LOGO = [
  "-----------------------------------------------------------------------------------------------------------------------------------------------",
  "-----------------------------------------------------------------------------------------------------------------------------------------------",
  "-----------------------------------------------------------------------------------------------------------------------------------------------",
  "-----------------------------------------------------------------------------------------------------------------------------------------------",
  "-----------------------------------------------------------------------------------------------------------------------------------------------",
  "-----------------------------------------------------------------------------------------------------------------------------------------------",
  "------------------------------------------------------------------------------------------------------------------------=----------------------",
  "-----------------------------------------------------------------------------------------+%%=------------------------=%%%%%--------------------",
  "---------------=------------------------------------------------------------------------=#%%=-----------------=---------#%%--------------------",
  "---------+%%%%%%%=-=%%%%%%*-=%%%%%%%*--#%%%%%%=------------+%%%%%#=-=%%%%%%%-=%%%%%%%#=%%%%%%%%*--%%%%%%%#-=%%%%%%%=----#%%=-------------------",
  "---------+%%*--%%+=%%*==+#%+=%%*-=+%%=*%#---*#%--=%%%%%+--=%#=-----=%%*--=#%#=%%#=-#%%=--#%%==----%%%=-*%%=%%#=--%%%=---*%%=-------------------",
  "---------+%%=-----=%%#####*==%%*--+%%=#%*---+%%--=*****=--+%#------=%%+--=#%#=%%#--#%%=--#%%=-----%%%-----=%%#=-=%%%=---#%%=-------------------",
  "---------+%%=------*%%%%%%%-=%%%%%%%*-=%%%%%%%=------------#%%%%%#=-*%%%%%%%-=%%#-=#%%=--*%%%%%*--%%%=-----*%%%%%%%+-+%%%%%%%=-----------------",
  "---------=**---------+***+--=%%#**+-----=***=---------------=+**+=---=+***=---**+--+#*----=*###=--*#+--------+##*+---=#######=-----------------",
  "-----------------------------%%*---------------------------------------------------------------------------------------------------------------",
  "-----------------------------------------------------------------------------------------------------------------------------------------------",
  "-----------------------------------------------------------------------------------------------------------------------------------------------",
  "-----------------------------------------------------------------------------------------------------------------------------------------------",
  "-----------------------------------------------------------------------------------------------------------------------------------------------",
  "-----------------------------------------------------------------------------------------------------------------------------------------------",
  "-----------------------------------------------------------------------------------------------------------------------------------------------"
];
const STARTUP_BANNER_CONTENT_WIDTH = Math.max(76, ...STARTUP_BANNER_LOGO.map((line) => line.length));

function getStartupBanner(): string {
  const apiHost = env.HOST === "127.0.0.1" ? "localhost" : env.HOST;

  return [
    "",
    bannerBorder("="),
    bannerLine(),
    bannerLine(centerBannerText("repo-control")),
    bannerLine(centerBannerText("local repository command center")),
    bannerLine(),
    ...STARTUP_BANNER_LOGO.map((line) => bannerLine(centerBannerText(line))),
    bannerLine(),
    bannerBorder("-"),
    ...bannerField("UI", "http://localhost:5173"),
    ...bannerField("API", `http://${apiHost}:${env.PORT}`),
    ...bannerField("Root", activeRootPath),
    ...bannerField("Logs", "errors only"),
    bannerBorder("-"),
    bannerLine(centerBannerText("Ready. Open the UI and manage your workspace.")),
    bannerLine(),
    bannerBorder("="),
    ""
  ].join("\n");
}

function bannerBorder(character: string): string {
  return `  +${character.repeat(STARTUP_BANNER_CONTENT_WIDTH + 2)}+`;
}

function bannerLine(content = ""): string {
  const normalizedContent = content.slice(0, STARTUP_BANNER_CONTENT_WIDTH);

  return `  | ${normalizedContent.padEnd(STARTUP_BANNER_CONTENT_WIDTH)} |`;
}

function centerBannerText(content: string): string {
  const safeContent = content.slice(0, STARTUP_BANNER_CONTENT_WIDTH);
  const leftPadding = Math.max(0, Math.floor((STARTUP_BANNER_CONTENT_WIDTH - safeContent.length) / 2));

  return `${" ".repeat(leftPadding)}${safeContent}`;
}

function bannerField(label: string, value: string): string[] {
  const labelWidth = 8;
  const prefix = `  ${label.padEnd(labelWidth)}`;
  const availableValueWidth = STARTUP_BANNER_CONTENT_WIDTH - prefix.length;
  const chunks = splitBannerValue(value, availableValueWidth);

  return chunks.map((chunk, index) => {
    const rowPrefix = index === 0 ? prefix : " ".repeat(prefix.length);

    return bannerLine(`${rowPrefix}${chunk}`);
  });
}

function splitBannerValue(value: string, width: number): string[] {
  if (value.length <= width) {
    return [value];
  }

  const chunks: string[] = [];
  let remainingValue = value;

  while (remainingValue.length > width) {
    chunks.push(remainingValue.slice(0, width));
    remainingValue = remainingValue.slice(width);
  }

  if (remainingValue) {
    chunks.push(remainingValue);
  }

  return chunks;
}

await app.listen({ host: env.HOST, port: env.PORT });
console.log(getStartupBanner());
