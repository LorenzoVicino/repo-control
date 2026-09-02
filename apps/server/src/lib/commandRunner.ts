import { spawn, type ChildProcess } from "node:child_process";
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
  signal?: AbortSignal;
};

export type ShellCommandRunner = (
  cwd: string,
  commandLine: string,
  timeoutMs: number,
  options?: ShellCommandRunnerOptions
) => Promise<CommandResult>;

const OUTPUT_MAX_LENGTH = 30_000;

// A timed-out or aborted process is asked to terminate (SIGTERM), then forcibly killed
// (SIGKILL) if it hasn't exited after this grace period.
const KILL_ESCALATION_GRACE_MS = 3_000;
// Node only fires 'close' once stdio pipes are drained, which never happens if a
// backgrounded grandchild keeps the inherited stdout/stderr open. 'exit' fires reliably
// as soon as the direct child is gone, so we settle from it if 'close' doesn't follow
// shortly after.
const EXIT_TO_CLOSE_GRACE_MS = 500;
// Safety net: settle regardless of any further process-tree activity once we've already
// escalated to SIGKILL.
const FORCE_SETTLE_AFTER_KILL_MS = 2_000;

export function runProjectCommand(
  cwd: string,
  command: string,
  args: string[],
  timeoutMs = 1000 * 60 * 3,
  options: CommandRunnerOptions = {}
): Promise<CommandResult> {
  const displayCommand = options.displayCommand ?? [command, ...args].join(" ");
  const child = spawn(command, args, {
    cwd,
    shell: options.shell ?? shouldUseShellForCommand(command),
    detached: process.platform !== "win32"
  });

  return runManagedCommand(child, displayCommand, timeoutMs, options.signal);
}

export function runShellCommand(
  cwd: string,
  commandLine: string,
  timeoutMs: number,
  options: ShellCommandRunnerOptions = {}
): Promise<CommandResult> {
  const terminalCommand = getTerminalCommand(commandLine);
  const child = spawn(terminalCommand.command, terminalCommand.args, {
    cwd,
    shell: terminalCommand.shell ?? shouldUseShellForCommand(terminalCommand.command),
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      ...options.env,
      FORCE_COLOR: "1",
      TERM: process.env.TERM ?? "xterm-256color"
    }
  });

  return runManagedCommand(child, terminalCommand.displayCommand ?? commandLine, timeoutMs, options.signal);
}

function runManagedCommand(
  child: ChildProcess,
  displayCommand: string,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<CommandResult> {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let stopReason: "timeout" | "abort" | null = null;
    let latestExitCode: number | null = null;

    let escalationTimer: NodeJS.Timeout | undefined;
    let forceSettleTimer: NodeJS.Timeout | undefined;
    let exitGraceTimer: NodeJS.Timeout | undefined;

    const clearAllTimers = (): void => {
      clearTimeout(timeoutTimer);
      clearTimeout(escalationTimer);
      clearTimeout(forceSettleTimer);
      clearTimeout(exitGraceTimer);
    };

    const onAbort = (): void => beginKillEscalation("abort");

    function settle(exitCode: number | null): void {
      if (settled) {
        return;
      }
      settled = true;
      clearAllTimers();
      signal?.removeEventListener("abort", onAbort);

      const stopMessage =
        stopReason === "timeout"
          ? `Command timed out after ${timeoutMs}ms`
          : stopReason === "abort"
            ? "Command cancelled"
            : "";

      resolve({
        ok: exitCode === 0 && stopReason === null,
        command: displayCommand,
        exitCode,
        stdout,
        stderr: appendOutput(stderr, stopMessage),
        output: [stdout, stderr, stopMessage].filter(Boolean).join("\n"),
        durationMs: Date.now() - startedAt
      });
    }

    const killTree = (signalToSend: NodeJS.Signals): void => killProcessTree(child, signalToSend);

    function beginKillEscalation(reason: "timeout" | "abort"): void {
      if (stopReason) {
        return;
      }
      stopReason = reason;
      killTree("SIGTERM");
      escalationTimer = setTimeout(() => {
        killTree("SIGKILL");
        child.stdout?.destroy();
        child.stderr?.destroy();
        forceSettleTimer = setTimeout(() => settle(latestExitCode), FORCE_SETTLE_AFTER_KILL_MS);
      }, KILL_ESCALATION_GRACE_MS);
    }

    if (signal?.aborted) {
      onAbort();
    } else {
      signal?.addEventListener("abort", onAbort, { once: true });
    }

    const timeoutTimer = setTimeout(() => beginKillEscalation("timeout"), timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout = appendOutput(stdout, chunk.toString("utf8"));
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = appendOutput(stderr, chunk.toString("utf8"));
    });

    child.on("error", (error) => {
      stderr = appendOutput(stderr, describeSpawnError(error, displayCommand));
      settle(null);
    });

    child.on("exit", (exitCode) => {
      latestExitCode = exitCode;
      exitGraceTimer = setTimeout(() => settle(exitCode), EXIT_TO_CLOSE_GRACE_MS);
    });

    child.on("close", (exitCode) => {
      clearTimeout(exitGraceTimer);
      settle(exitCode);
    });
  });
}

// Exported because a long-lived container session has the same problem as a one-shot
// command: the direct child is a `docker` client whose work happens in a process group,
// and killing only the client leaves the group behind.
export function killProcessTree(child: ChildProcess, signalToSend: NodeJS.Signals): void {
  if (!child.pid) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }

  try {
    // Negative pid targets the whole detached process group, not just the direct child.
    process.kill(-child.pid, signalToSend);
  } catch {
    try {
      child.kill(signalToSend);
    } catch {
      // Process already gone.
    }
  }
}

// "spawn docker ENOENT" is accurate and useless to the person reading it. Optional tools -
// Docker, an agent CLI, an editor launcher - are missing often enough that the message
// should say so.
function describeSpawnError(error: Error, displayCommand: string): string {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    return error.message;
  }

  const [executable] = displayCommand.split(" ");

  return `${executable || "The command"} was not found on this machine. Install it, or set its path in the environment.`;
}

function appendOutput(current: string, next: string): string {
  const combined = current + next;

  return combined.length > OUTPUT_MAX_LENGTH ? combined.slice(combined.length - OUTPUT_MAX_LENGTH) : combined;
}
