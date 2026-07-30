import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { isWsl } from "../runtime.js";
import type { AgentResumeSpec } from "./agentSessionService.js";

export type NativeTerminalResult = {
  ok: boolean;
  message: string;
  command: string;
};

export type NativeTerminalLauncher = (
  cwd: string,
  resumeSpec: AgentResumeSpec
) => Promise<NativeTerminalResult>;

type SpawnProcess = typeof spawn;
export type TerminalCandidate = {
  command: string;
  args: string[];
};
export type NativeTerminalRuntime = {
  platform?: NodeJS.Platform;
  wsl?: boolean;
  env?: NodeJS.ProcessEnv;
};

export async function openAgentSessionInNativeTerminal(
  cwd: string,
  resumeSpec: AgentResumeSpec,
  spawnProcess: SpawnProcess = spawn
): Promise<NativeTerminalResult> {
  const candidates = await getTerminalCandidates(cwd, resumeSpec);
  const failures: string[] = [];

  for (const candidate of candidates) {
    const launched = await spawnDetached(candidate, cwd, spawnProcess);

    if (launched.ok) {
      return {
        ok: true,
        message: "Terminale aperto. La sessione sta riprendendo.",
        command: resumeSpec.displayCommand
      };
    }

    failures.push(`${candidate.command}: ${launched.error}`);
  }

  return {
    ok: false,
    message: [
      "Non ho trovato un terminale grafico utilizzabile.",
      `Esegui manualmente dalla cartella del repository: ${resumeSpec.displayCommand}`,
      failures.length > 0 ? `Tentativi: ${failures.join("; ")}` : ""
    ].filter(Boolean).join(" "),
    command: resumeSpec.displayCommand
  };
}

export async function getTerminalCandidates(
  cwd: string,
  resumeSpec: AgentResumeSpec,
  runtime: NativeTerminalRuntime = {}
): Promise<TerminalCandidate[]> {
  const env = runtime.env ?? process.env;
  const platform = runtime.platform ?? process.platform;
  const configuredTerminal = env.REPO_CONTROL_TERMINAL?.trim();

  if (configuredTerminal) {
    return [{
      command: configuredTerminal,
      args: ["-e", resumeSpec.command, ...resumeSpec.args]
    }];
  }

  if (platform === "win32") {
    return [
      {
        command: "wt.exe",
        args: ["-d", cwd, resumeSpec.command, ...resumeSpec.args]
      },
      {
        command: "powershell.exe",
        args: [
          "-NoExit",
          "-Command",
          `Set-Location -LiteralPath ${powerShellQuote(cwd)}; & ${powerShellQuote(resumeSpec.command)} ${resumeSpec.args.map(powerShellQuote).join(" ")}`
        ]
      }
    ];
  }

  if (platform === "darwin") {
    const commandLine = [
      `cd ${posixShellQuote(cwd)}`,
      `exec ${posixShellQuote(resumeSpec.command)} ${resumeSpec.args.map(posixShellQuote).join(" ")}`
    ].join(" && ");

    return [{
      command: "osascript",
      args: ["-e", `tell application "Terminal" to do script ${appleScriptQuote(commandLine)}`]
    }];
  }

  const linuxCandidates: TerminalCandidate[] = [
    { command: "x-terminal-emulator", args: ["-e", resumeSpec.command, ...resumeSpec.args] },
    { command: "gnome-terminal", args: ["--", resumeSpec.command, ...resumeSpec.args] },
    { command: "konsole", args: ["-e", resumeSpec.command, ...resumeSpec.args] },
    { command: "kitty", args: [resumeSpec.command, ...resumeSpec.args] },
    { command: "alacritty", args: ["-e", resumeSpec.command, ...resumeSpec.args] }
  ];

  const runningInWsl = runtime.wsl ?? await isWsl();

  if (runningInWsl) {
    const distroArgs = env.WSL_DISTRO_NAME ? ["-d", env.WSL_DISTRO_NAME] : [];
    return [{
      command: "wt.exe",
      args: ["wsl.exe", ...distroArgs, "--cd", cwd, resumeSpec.command, ...resumeSpec.args]
    }, ...linuxCandidates];
  }

  return linuxCandidates;
}

function spawnDetached(
  candidate: TerminalCandidate,
  cwd: string,
  spawnProcess: SpawnProcess
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    let child: ChildProcess;

    try {
      child = spawnProcess(candidate.command, candidate.args, {
        cwd,
        detached: true,
        stdio: "ignore",
        windowsHide: false
      });
    } catch (error) {
      resolve({ ok: false, error: getErrorMessage(error) });
      return;
    }

    child.once("spawn", () => {
      child.unref();
      resolve({ ok: true });
    });
    child.once("error", (error) => {
      resolve({ ok: false, error: error.message });
    });
  });
}

function posixShellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function powerShellQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function appleScriptQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "errore sconosciuto";
}
