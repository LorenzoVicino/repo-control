import assert from "node:assert/strict";
import test from "node:test";
import { runProjectCommand, runShellCommand } from "./commandRunner.js";

test("captures command output, exit status and display command", async () => {
  const result = await runProjectCommand(
    process.cwd(),
    "git",
    ["--version"],
    5_000,
    { displayCommand: "node smoke-check" }
  );

  assert.equal(result.ok, true);
  assert.equal(result.exitCode, 0);
  assert.equal(result.command, "node smoke-check");
  assert.match(result.stdout, /^git version /);
  assert.equal(result.stderr, "");
  assert.equal(result.output, result.stdout);
});

test("reports non-zero exits and spawn failures", async () => {
  const failedResult = await runProjectCommand(
    process.cwd(),
    process.execPath,
    ["-e", "process.exit(7)"],
    5_000
  );
  const missingResult = await runProjectCommand(
    process.cwd(),
    `missing-command-${Date.now()}`,
    [],
    5_000,
    { shell: false }
  );

  assert.equal(failedResult.ok, false);
  assert.equal(failedResult.exitCode, 7);
  assert.equal(missingResult.ok, false);
  assert.equal(missingResult.exitCode, null);
  assert.ok(missingResult.stderr.length > 0);
});

test("times out long-running commands", async () => {
  const timeoutResult = await runProjectCommand(
    process.cwd(),
    process.execPath,
    ["-e", "setTimeout(() => {}, 10000)"],
    30
  );

  assert.equal(timeoutResult.ok, false);
  assert.match(timeoutResult.stderr, /timed out/);
});

test("settles promptly even when the command backgrounds a process that outlives it", {
  skip: process.platform === "win32" ? "Unix process-group behavior is covered on CI" : false
}, async () => {
  const startedAt = Date.now();
  const result = await runShellCommand(process.cwd(), "sleep 5 & echo parent-done", 10_000);
  const elapsedMs = Date.now() - startedAt;

  assert.equal(result.ok, true);
  assert.match(result.stdout, /parent-done/);
  assert.ok(elapsedMs < 2_000, `expected prompt settlement, took ${elapsedMs}ms`);
});

test("escalates to SIGKILL when a timed-out process ignores SIGTERM", async () => {
  const startedAt = Date.now();
  const result = await runShellCommand(process.cwd(), "trap '' TERM; sleep 10", 100);
  const elapsedMs = Date.now() - startedAt;

  assert.equal(result.ok, false);
  assert.match(result.stderr, /timed out/);
  assert.ok(elapsedMs < 7_000, `expected SIGKILL escalation well before the sleep finished, took ${elapsedMs}ms`);
});
