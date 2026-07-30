import assert from "node:assert/strict";
import type { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  getTerminalCandidates,
  openAgentSessionInNativeTerminal
} from "./nativeTerminalService.js";

test("uses Windows Terminal before Linux terminals when running in WSL", async () => {
  const candidates = await getTerminalCandidates(
    "/home/user/workspace/product",
    {
      command: "codex",
      args: ["resume", "session-id"],
      displayCommand: "codex resume session-id"
    },
    {
      platform: "linux",
      wsl: true,
      env: { WSL_DISTRO_NAME: "Ubuntu" }
    }
  );

  assert.deepEqual(candidates[0], {
    command: "wt.exe",
    args: [
      "wsl.exe",
      "-d",
      "Ubuntu",
      "--cd",
      "/home/user/workspace/product",
      "codex",
      "resume",
      "session-id"
    ]
  });
});

test("opens the validated resume command with the configured native terminal", async (context) => {
  const previousTerminal = process.env.REPO_CONTROL_TERMINAL;
  const calls: Array<{ command: string; args: readonly string[]; cwd: string | undefined }> = [];
  process.env.REPO_CONTROL_TERMINAL = "test-terminal";
  context.after(() => restoreEnv("REPO_CONTROL_TERMINAL", previousTerminal));

  const spawnProcess = ((command: string, args: readonly string[], options: { cwd?: string }) => {
    calls.push({ command, args, cwd: options.cwd });
    const child = new EventEmitter() as EventEmitter & { unref: () => void };
    child.unref = () => {};
    process.nextTick(() => child.emit("spawn"));
    return child;
  }) as unknown as typeof spawn;

  const result = await openAgentSessionInNativeTerminal(
    "/workspace/product",
    {
      command: "codex",
      args: ["resume", "session-id"],
      displayCommand: "codex resume session-id"
    },
    spawnProcess
  );

  assert.equal(result.ok, true);
  assert.deepEqual(calls, [{
    command: "test-terminal",
    args: ["-e", "codex", "resume", "session-id"],
    cwd: "/workspace/product"
  }]);
});

test("returns the manual resume command when the terminal cannot be opened", async (context) => {
  const previousTerminal = process.env.REPO_CONTROL_TERMINAL;
  process.env.REPO_CONTROL_TERMINAL = "missing-terminal";
  context.after(() => restoreEnv("REPO_CONTROL_TERMINAL", previousTerminal));

  const spawnProcess = (() => {
    const child = new EventEmitter() as EventEmitter & { unref: () => void };
    child.unref = () => {};
    process.nextTick(() => child.emit("error", new Error("not found")));
    return child;
  }) as unknown as typeof spawn;

  const result = await openAgentSessionInNativeTerminal(
    "/workspace/product",
    {
      command: "claude",
      args: ["--resume", "session-id"],
      displayCommand: "claude --resume session-id"
    },
    spawnProcess
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /claude --resume session-id/);
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
