import { promises as fs } from "node:fs";
import path from "node:path";
import { runProjectCommand } from "../lib/commandRunner.js";
import type { CommandResult } from "../lib/commandRunner.js";
import { getNpmCommand } from "../runtime.js";

export type AppUpdateResult = CommandResult & {
  restartScheduled: boolean;
};

export type AppUpdateStatus = {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  checkedAt: string;
  error: string | null;
};

export async function readAppUpdateStatus(): Promise<AppUpdateStatus> {
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

export async function updateApplication(): Promise<AppUpdateResult> {
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

function readLocalAppVersion(appRootPath: string): Promise<string> {
  return fs
    .readFile(path.join(appRootPath, "package.json"), "utf8")
    .then((packageJson) => {
      try {
        const parsedPackageJson = JSON.parse(packageJson) as { version?: unknown };
        return typeof parsedPackageJson.version === "string" ? parsedPackageJson.version : "0.0.0";
      } catch {
        return "0.0.0";
      }
    })
    .catch(() => "0.0.0");
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
