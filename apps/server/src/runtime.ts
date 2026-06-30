import { promises as fs } from "node:fs";
import path from "node:path";

export type RuntimeCommandSpec = {
  command: string;
  args: string[];
  displayCommand?: string;
  shell?: boolean;
};

export function getNpmCommand(): string {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

export function getTerminalCommand(commandLine: string): RuntimeCommandSpec {
  const configuredShell = process.env.REPO_CONTROL_SHELL?.trim();

  if (configuredShell) {
    return {
      command: configuredShell,
      args: getGenericShellArgs(configuredShell, commandLine),
      displayCommand: commandLine
    };
  }

  if (process.platform === "win32") {
    const wrappedCommand = [
      "$ErrorActionPreference = 'Continue'",
      commandLine,
      "if ($global:LASTEXITCODE -ne $null) { exit $global:LASTEXITCODE }"
    ].join("; ");

    return {
      command: "powershell.exe",
      args: ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", wrappedCommand],
      displayCommand: commandLine
    };
  }

  const shell = process.env.SHELL ?? "/bin/bash";

  return {
    command: shell,
    args: getGenericShellArgs(shell, commandLine),
    displayCommand: commandLine
  };
}

export function shouldUseShellForCommand(command: string): boolean {
  if (process.platform !== "win32") {
    return false;
  }

  const normalizedCommand = command.toLowerCase();
  return normalizedCommand.endsWith(".bat") || normalizedCommand.endsWith(".cmd");
}

export async function getVSCodeLauncherCandidates(): Promise<RuntimeCommandSpec[]> {
  const candidates: RuntimeCommandSpec[] = [];

  if (process.env.REPO_CONTROL_VSCODE) {
    candidates.push({
      command: process.env.REPO_CONTROL_VSCODE,
      args: [],
      shell: process.platform === "win32" || shouldUseShellForCommand(process.env.REPO_CONTROL_VSCODE)
    });
  }

  if (process.platform === "win32") {
    candidates.push(
      { command: "code.cmd", args: [], shell: true },
      { command: "code-insiders.cmd", args: [], shell: true },
      { command: "codium.cmd", args: [], shell: true },
      { command: "code", args: [], shell: true },
      { command: "code-insiders", args: [], shell: true },
      { command: "codium", args: [], shell: true }
    );

    for (const command of await findNativeWindowsVSCodeLaunchers()) {
      candidates.push({ command, args: [], shell: true });
    }
  } else {
    candidates.push(
      { command: "code", args: [] },
      { command: "code-insiders", args: [] },
      { command: "codium", args: [] }
    );

    if (await isWsl()) {
      for (const command of await findWslWindowsVSCodeLaunchers()) {
        candidates.push({ command, args: [] });
      }
    }
  }

  return dedupeCandidates(candidates);
}

export async function getVSCodeFailureHint(): Promise<string> {
  if (process.platform === "win32") {
    return [
      "Install VS Code for Windows and enable the shell command,",
      "or set REPO_CONTROL_VSCODE to the full code.cmd path."
    ].join(" ");
  }

  if (await isWsl()) {
    return [
      "Install the VS Code Remote WSL shell command, add code to PATH,",
      "or set REPO_CONTROL_VSCODE to the full launcher path."
    ].join(" ");
  }

  return "Install the VS Code shell command, add it to PATH, or set REPO_CONTROL_VSCODE to the full launcher path.";
}

export async function isWsl(): Promise<boolean> {
  if (process.env.WSL_DISTRO_NAME) {
    return true;
  }

  const version = await fs.readFile("/proc/version", "utf8").catch(() => "");
  return version.toLowerCase().includes("microsoft") || version.toLowerCase().includes("wsl");
}

function getGenericShellArgs(shell: string, commandLine: string): string[] {
  const shellName = path.basename(shell).toLowerCase();

  if (shellName === "cmd.exe" || shellName === "cmd") {
    return ["/d", "/s", "/c", commandLine];
  }

  if (shellName.includes("powershell") || shellName === "pwsh.exe" || shellName === "pwsh") {
    return ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", commandLine];
  }

  if (shellName.includes("fish")) {
    return ["-c", commandLine];
  }

  return ["-lc", commandLine];
}

async function findNativeWindowsVSCodeLaunchers(): Promise<string[]> {
  const basePaths = [
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, "Programs") : null,
    process.env.ProgramFiles ?? null,
    process.env["ProgramFiles(x86)"] ?? null
  ].filter((basePath): basePath is string => Boolean(basePath));

  const launchers = basePaths.flatMap((basePath) => [
    path.join(basePath, "Microsoft VS Code", "bin", "code.cmd"),
    path.join(basePath, "Microsoft VS Code Insiders", "bin", "code-insiders.cmd"),
    path.join(basePath, "VSCodium", "bin", "codium.cmd")
  ]);

  return existingFiles(launchers);
}

async function findWslWindowsVSCodeLaunchers(): Promise<string[]> {
  const launchers = [
    "/mnt/c/Program Files/Microsoft VS Code/bin/code",
    "/mnt/c/Program Files/Microsoft VS Code Insiders/bin/code-insiders",
    "/mnt/c/Program Files/VSCodium/bin/codium"
  ];
  const usersPath = "/mnt/c/Users";
  const users = await fs.readdir(usersPath).catch(() => []);

  for (const user of users) {
    launchers.push(
      path.posix.join(usersPath, user, "AppData/Local/Programs/Microsoft VS Code/bin/code"),
      path.posix.join(usersPath, user, "AppData/Local/Programs/Microsoft VS Code Insiders/bin/code-insiders"),
      path.posix.join(usersPath, user, "AppData/Local/Programs/VSCodium/bin/codium")
    );
  }

  return existingFiles(launchers);
}

async function existingFiles(paths: string[]): Promise<string[]> {
  const checks = await Promise.all(
    paths.map(async (filePath) => {
      try {
        await fs.access(filePath);
        return filePath;
      } catch {
        return null;
      }
    })
  );

  return checks.filter((filePath): filePath is string => filePath !== null);
}

function dedupeCandidates(candidates: RuntimeCommandSpec[]): RuntimeCommandSpec[] {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = [candidate.command, ...candidate.args, String(candidate.shell ?? false)].join("\0");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
