import cors from "@fastify/cors";
import Fastify from "fastify";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { simpleGit } from "simple-git";
import type { StatusResult } from "simple-git";
import { z } from "zod";
import { scanProjects } from "./gitScanner.js";

const envSchema = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().default(3747),
  REPO_CONTROL_ROOT: z.string().default(process.cwd())
});

const env = envSchema.parse(process.env);
const app = Fastify({ logger: true });
let activeRootPath = resolveRootInput(env.REPO_CONTROL_ROOT);

await app.register(cors, {
  origin: ["http://127.0.0.1:5173", "http://localhost:5173"]
});

app.get("/api/health", async () => ({
  ok: true,
  root: activeRootPath
}));

app.get("/api/projects", async () => ({
  root: activeRootPath,
  projects: await scanProjects(activeRootPath)
}));

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
  const pickerResult = await openNativeFolderPicker(initialPath);

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

app.post("/api/projects/:id/git/unstage-all", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const projectPath = await resolveProjectPath(params.id);

  return runProjectCommand(projectPath, "git", ["reset"]);
});

app.post("/api/projects/:id/git/commit", async (request) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const body = z.object({ message: z.string().trim().min(1).max(500) }).parse(request.body);
  const projectPath = await resolveProjectPath(params.id);

  return runProjectCommand(projectPath, "git", ["commit", "-m", body.message]);
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

async function resolveProjectPath(id: string): Promise<string> {
  const decodedPath = Buffer.from(id, "base64url").toString("utf8");
  const projectPath = path.resolve(decodedPath);
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

type GitChangeGroups = {
  staged: string[];
  modified: string[];
  deleted: string[];
  renamed: string[];
  untracked: string[];
  conflicted: string[];
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
};

async function readGitDetails(projectPath: string): Promise<GitDetails> {
  const git = simpleGit(projectPath);
  const [status, localBranchesRaw, remoteBranchesRaw] = await Promise.all([
    git.status(),
    git.raw(["branch", "--format=%(refname:short)|%(HEAD)|%(upstream:short)|%(upstream:track)", "--sort=refname"]),
    git.raw([
      "branch",
      "-r",
      "--format=%(refname:short)|%(HEAD)|%(upstream:short)|%(upstream:track)",
      "--sort=refname"
    ])
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
    }
  };
}

function getChangeGroups(status: StatusResult): GitChangeGroups {
  return {
    staged: uniqueSorted(status.staged),
    modified: uniqueSorted(status.modified),
    deleted: uniqueSorted(status.deleted),
    renamed: uniqueSorted(status.renamed.map((file) => `${file.from} -> ${file.to}`)),
    untracked: uniqueSorted(status.not_added),
    conflicted: uniqueSorted(status.conflicted)
  };
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

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
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

type FolderPickerResult = {
  ok: boolean;
  path?: string;
  cancelled?: boolean;
  message?: string;
};

function runProjectCommand(
  cwd: string,
  command: string,
  args: string[],
  timeoutMs = 1000 * 60 * 3
): Promise<CommandResult> {
  const startedAt = Date.now();
  const displayCommand = [command, ...args].join(" ");

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      shell: false
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

async function openNativeFolderPicker(initialPath: string): Promise<FolderPickerResult> {
  const candidates = await getFolderPickerCandidates(initialPath);
  const failures: string[] = [];

  for (const candidate of candidates) {
    const result = await runProjectCommand(process.cwd(), candidate.command, candidate.args, 1000 * 60 * 5);
    const selectedPath = result.stdout.trim();

    if (result.ok && selectedPath) {
      return {
        ok: true,
        path: normalizePickedPath(selectedPath)
      };
    }

    if (result.ok && !selectedPath) {
      return {
        ok: false,
        cancelled: true
      };
    }

    if (isFolderPickerCancel(result)) {
      return {
        ok: false,
        cancelled: true
      };
    }

    failures.push(`${result.command}\n${result.output || "No output"}`);
  }

  return {
    ok: false,
    message: [
      "Unable to open a native folder picker.",
      "Install zenity/kdialog on Linux, use macOS Finder, or run from Windows/WSL with PowerShell available.",
      "",
      "Tried:",
      ...failures.map((failure) => `- ${failure.split("\n")[0]}`)
    ].join("\n")
  };
}

async function getFolderPickerCandidates(initialPath: string): Promise<Array<{ command: string; args: string[] }>> {
  if (process.platform === "win32") {
    return getPowerShellFolderPickerCandidates(initialPath);
  }

  if (process.platform === "darwin") {
    return [
      {
        command: "osascript",
        args: ["-e", `POSIX path of (choose folder with prompt "Select repo-control workspace folder")`]
      }
    ];
  }

  if (await isWsl()) {
    return getPowerShellFolderPickerCandidates(toWindowsPickerPath(initialPath));
  }

  return [
    {
      command: "zenity",
      args: ["--file-selection", "--directory", "--title=Select repo-control workspace folder", `--filename=${initialPath}`]
    },
    {
      command: "kdialog",
      args: ["--getexistingdirectory", initialPath, "--title", "Select repo-control workspace folder"]
    }
  ];
}

function getPowerShellFolderPickerCandidates(initialPath: string): Array<{ command: string; args: string[] }> {
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = 'Select repo-control workspace folder'",
    "$dialog.ShowNewFolderButton = $true",
    initialPath ? `$dialog.SelectedPath = '${escapePowerShellString(initialPath)}'` : "",
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }"
  ]
    .filter(Boolean)
    .join("; ");

  return [
    {
      command: "powershell.exe",
      args: ["-NoProfile", "-STA", "-Command", script]
    },
    {
      command: "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
      args: ["-NoProfile", "-STA", "-Command", script]
    }
  ];
}

function isFolderPickerCancel(result: CommandResult): boolean {
  const output = result.output.toLowerCase();

  return result.exitCode !== null && !result.stdout.trim() && (output.includes("cancel") || output.trim().length === 0);
}

async function isWsl(): Promise<boolean> {
  if (process.env.WSL_DISTRO_NAME) {
    return true;
  }

  const version = await fs.readFile("/proc/version", "utf8").catch(() => "");
  return version.toLowerCase().includes("microsoft") || version.toLowerCase().includes("wsl");
}

function toWindowsPickerPath(localPath: string): string {
  const mountMatch = localPath.match(/^\/mnt\/([a-z])\/(.*)$/i);

  if (mountMatch) {
    return `${mountMatch[1].toUpperCase()}:\\${mountMatch[2].replaceAll("/", "\\")}`;
  }

  if (process.env.WSL_DISTRO_NAME && localPath.startsWith("/")) {
    return `\\\\wsl.localhost\\${process.env.WSL_DISTRO_NAME}${localPath.replaceAll("/", "\\")}`;
  }

  return localPath;
}

function normalizePickedPath(pickedPath: string): string {
  const normalized = pickedPath.replace(/\r/g, "").trim();
  const driveMatch = normalized.match(/^([A-Za-z]):[\\/](.*)$/);

  if (process.platform !== "win32" && driveMatch) {
    return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2].replaceAll("\\", "/")}`;
  }

  const wslShareMatch = normalized.match(/^\\\\wsl(?:\.localhost)?\\[^\\]+\\(.+)$/i);

  if (process.platform !== "win32" && wslShareMatch) {
    return `/${wslShareMatch[1].replaceAll("\\", "/")}`;
  }

  return normalized;
}

function escapePowerShellString(value: string): string {
  return value.replaceAll("'", "''");
}

function runShellCommand(cwd: string, commandLine: string, timeoutMs: number): Promise<CommandResult> {
  const startedAt = Date.now();
  const shell = getDefaultShell();

  return new Promise((resolve) => {
    const child = spawn(commandLine, {
      cwd,
      shell,
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
        command: commandLine,
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
        command: commandLine,
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
    const result = await runProjectCommand(projectPath, candidate.command, [...candidate.args, projectPath], 1000 * 20);

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
      "Install the VS Code shell command in WSL, add it to PATH, or set REPO_CONTROL_VSCODE to the full launcher path.",
      "",
      "Tried:",
      ...failures.map((failure) => `- ${failure.split("\n")[0]}`)
    ].join("\n"),
    durationMs: 0
  };
}

async function getVSCodeLauncherCandidates(): Promise<Array<{ command: string; args: string[] }>> {
  const candidates: Array<{ command: string; args: string[] }> = [];

  if (process.env.REPO_CONTROL_VSCODE) {
    candidates.push({ command: process.env.REPO_CONTROL_VSCODE, args: [] });
  }

  candidates.push(
    { command: "code", args: [] },
    { command: "code-insiders", args: [] },
    { command: "codium", args: [] }
  );

  for (const command of await findWindowsVSCodeLaunchers()) {
    candidates.push({ command, args: [] });
  }

  return dedupeCandidates(candidates);
}

async function findWindowsVSCodeLaunchers(): Promise<string[]> {
  const launchers = [
    "/mnt/c/Program Files/Microsoft VS Code/bin/code",
    "/mnt/c/Program Files/Microsoft VS Code Insiders/bin/code-insiders"
  ];
  const usersPath = "/mnt/c/Users";
  const users = await fs.readdir(usersPath).catch(() => []);

  for (const user of users) {
    launchers.push(
      path.join(usersPath, user, "AppData/Local/Programs/Microsoft VS Code/bin/code"),
      path.join(usersPath, user, "AppData/Local/Programs/Microsoft VS Code Insiders/bin/code-insiders")
    );
  }

  const checks = await Promise.all(
    launchers.map(async (launcher) => {
      try {
        await fs.access(launcher);
        return launcher;
      } catch {
        return null;
      }
    })
  );

  return checks.filter((launcher): launcher is string => launcher !== null);
}

function dedupeCandidates(
  candidates: Array<{ command: string; args: string[] }>
): Array<{ command: string; args: string[] }> {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = [candidate.command, ...candidate.args].join("\0");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getDefaultShell(): string {
  if (process.platform === "win32") {
    return process.env.ComSpec ?? "cmd.exe";
  }

  return process.env.SHELL ?? "/bin/bash";
}

function appendOutput(current: string, next: string): string {
  const maxLength = 30_000;
  const combined = current + next;

  return combined.length > maxLength ? combined.slice(combined.length - maxLength) : combined;
}

await app.listen({ host: env.HOST, port: env.PORT });
