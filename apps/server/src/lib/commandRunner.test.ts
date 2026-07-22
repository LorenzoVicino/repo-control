import assert from "node:assert/strict";
import test from "node:test";
import { runProjectCommand } from "./commandRunner.js";

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
