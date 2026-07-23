import { spawn } from "node:child_process";
import { getTerminalCommand, shouldUseShellForCommand } from "../runtime.js";

export type CommandResult = {
  ok: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  output: string;
  durationMs: number;
};

export type CommandRunner = (
  cwd: string,
  command: string,
  args: string[],
  timeoutMs?: number,
  options?: CommandRunnerOptions
) => Promise<CommandResult>;

export type CommandRunnerOptions = {
  displayCommand?: string;
  shell?: boolean;
  signal?: AbortSignal;
};

export type ShellCommandRunnerOptions = {
  env?: NodeJS.ProcessEnv;
};

export type ShellCommandRunner = (
  cwd: string,
  commandLine: string,
  timeoutMs: number,
  options?: ShellCommandRunnerOptions
) => Promise<CommandResult>;

export function runProjectCommand(
  cwd: string,
  command: string,
  args: string[],
  timeoutMs = 1000 * 60 * 3,
  options: CommandRunnerOptions = {}
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
    let didAbort = false;

    const abortCommand = () => {
      didAbort = true;
      child.kill("SIGTERM");
    };

    if (options.signal?.aborted) {
      abortCommand();
    } else {
      options.signal?.addEventListener("abort", abortCommand, { once: true });
    }

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
      options.signal?.removeEventListener("abort", abortCommand);
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
      options.signal?.removeEventListener("abort", abortCommand);
      const stopMessage = didTimeout
        ? `Command timed out after ${timeoutMs}ms`
        : didAbort
          ? "Command cancelled"
          : "";

      resolve({
        ok: exitCode === 0 && !didTimeout && !didAbort,
        command: displayCommand,
        exitCode,
        stdout,
        stderr: appendOutput(stderr, stopMessage),
        output: [stdout, stderr, stopMessage].filter(Boolean).join("\n"),
        durationMs: Date.now() - startedAt
      });
    });
  });
}

export function runShellCommand(
  cwd: string,
  commandLine: string,
  timeoutMs: number,
  options: ShellCommandRunnerOptions = {}
): Promise<CommandResult> {
  const startedAt = Date.now();
  const terminalCommand = getTerminalCommand(commandLine);

  return new Promise((resolve) => {
    const child = spawn(terminalCommand.command, terminalCommand.args, {
      cwd,
      shell: terminalCommand.shell ?? shouldUseShellForCommand(terminalCommand.command),
      env: {
        ...process.env,
        ...options.env,
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

function appendOutput(current: string, next: string): string {
  const maxLength = 30_000;
  const combined = current + next;

  return combined.length > maxLength ? combined.slice(combined.length - maxLength) : combined;
}
