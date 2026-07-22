import assert from "node:assert/strict";
import test from "node:test";
import { runProjectCommand } from "./commandRunner.js";

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
