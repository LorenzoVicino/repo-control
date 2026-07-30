import assert from "node:assert/strict";
import test from "node:test";
import { runProjectCommand, runShellCommand } from "./commandRunner.js";

test("cancels an active project command through AbortSignal", async () => {
  const abortController = new AbortController();
  const command = runProjectCommand(
    process.cwd(),
    process.execPath,
    ["-e", "setTimeout(() => {}, 10000)"],
    10_000,
    { signal: abortController.signal }
  );

  setTimeout(() => abortController.abort(), 30);
  const result = await command;

  assert.equal(result.ok, false);
  assert.match(result.stderr, /Command cancelled/);
});

test("cancels a shell command through AbortSignal and kills its process tree", async () => {
  const abortController = new AbortController();
  const startedAt = Date.now();
  const command = runShellCommand(process.cwd(), "sleep 10 & wait", 10_000, {
    signal: abortController.signal
  });

  setTimeout(() => abortController.abort(), 30);
  const result = await command;
  const elapsedMs = Date.now() - startedAt;

  assert.equal(result.ok, false);
  assert.match(result.stderr, /Command cancelled/);
  assert.ok(elapsedMs < 7_000, `expected cancellation to kill the backgrounded child, took ${elapsedMs}ms`);
});
