import assert from "node:assert/strict";
import Fastify from "fastify";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { ShellCommandRunnerOptions } from "../lib/commandRunner.js";
import { registerTerminalRoutes } from "./terminalRoutes.js";

test("runs, rejects concurrent work and cancels repository terminal commands", async (context) => {
  const configPath = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-terminal-routes-"));
  const previousConfigPath = process.env.REPO_CONTROL_CONFIG_DIR;
  process.env.REPO_CONTROL_CONFIG_DIR = configPath;
  const app = Fastify();
  let activeSignal: AbortSignal | null = null;

  context.after(async () => {
    await app.close();
    if (previousConfigPath === undefined) delete process.env.REPO_CONTROL_CONFIG_DIR;
    else process.env.REPO_CONTROL_CONFIG_DIR = previousConfigPath;
    await fs.rm(configPath, { recursive: true, force: true });
  });

  await registerTerminalRoutes(app, {
    getActiveRootPath: () => "C:\\workspace",
    setActiveRootPath: () => undefined,
    resolveProjectPath: async () => "C:\\workspace\\alpha",
    runShellCommand: async (_cwd, command, _timeout, options?: ShellCommandRunnerOptions) => {
      activeSignal = options?.signal ?? null;
      return new Promise((resolve) => {
        options?.signal?.addEventListener("abort", () => resolve({
          ok: false,
          command,
          exitCode: null,
          stdout: "",
          stderr: "Command cancelled",
          output: "Command cancelled",
          durationMs: 2
        }), { once: true });
      });
    }
  });

  const runPromise = app.inject({
    method: "POST",
    url: "/api/projects/alpha/terminal/run",
    payload: { command: "npm test" }
  });
  while (!activeSignal) await new Promise((resolve) => setImmediate(resolve));

  const concurrentResponse = await app.inject({
    method: "POST",
    url: "/api/projects/alpha/terminal/run",
    payload: { command: "npm run build" }
  });
  assert.equal(concurrentResponse.statusCode, 409);

  const cancelResponse = await app.inject({ method: "POST", url: "/api/projects/alpha/terminal/cancel" });
  assert.equal(cancelResponse.statusCode, 200);
  assert.equal(cancelResponse.json().cancelled, true);

  const runResponse = await runPromise;
  assert.equal(runResponse.statusCode, 200);
  assert.equal(runResponse.json().ok, false);
  assert.match(runResponse.json().output, /cancelled/);

  const missingCancelResponse = await app.inject({ method: "POST", url: "/api/projects/alpha/terminal/cancel" });
  assert.equal(missingCancelResponse.statusCode, 404);
});
