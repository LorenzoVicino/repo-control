import type { CommandResult } from "../types";

export function commandErrorResult(command: string, error: unknown): CommandResult {
  const message = error instanceof Error ? error.message : "Command failed";

  return {
    ok: false,
    command,
    exitCode: null,
    stdout: "",
    stderr: message,
    output: message,
    durationMs: 0
  };
}
