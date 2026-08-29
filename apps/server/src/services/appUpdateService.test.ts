import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { CommandResult, CommandRunner } from "../lib/commandRunner.js";
import { readAppUpdateStatus, updateApplication } from "./appUpdateService.js";

type RecordedCommand = { command: string; args: string[] };

function commandResult(overrides: Partial<CommandResult> = {}): CommandResult {
  return {
    ok: true,
    command: "git",
    exitCode: 0,
    stdout: "",
    stderr: "",
    output: "",
    durationMs: 1,
    ...overrides
  };
}

// Returns a runner that answers each invocation from `responses` in order, recording what
// was asked for so tests can assert on the command sequence itself.
function createRunner(responses: Array<Partial<CommandResult>>): {
  run: CommandRunner;
  calls: RecordedCommand[];
} {
  const calls: RecordedCommand[] = [];
  let index = 0;

  const run: CommandRunner = async (_cwd, command, args) => {
    calls.push({ command, args });
    const response = responses[index] ?? {};
    index += 1;
    return commandResult({ command, ...response });
  };

  return { run, calls };
}

async function createAppRoot(version: string, withGitDir = true): Promise<string> {
  const appRootPath = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-update-"));
  await fs.writeFile(path.join(appRootPath, "package.json"), JSON.stringify({ version }), "utf8");

  if (withGitDir) {
    await fs.mkdir(path.join(appRootPath, ".git"));
  }

  return appRootPath;
}

function tagRefs(...versions: string[]): string {
  return versions.map((version, index) => `${"a".repeat(40 - String(index).length)}${index}\trefs/tags/${version}`).join("\n");
}

test("reports the newest remote release and whether it is ahead of the local version", async () => {
  const appRootPath = await createAppRoot("0.8.2");
  const { run } = createRunner([{ stdout: tagRefs("v0.8.0", "v0.9.0", "v0.8.10") }]);

  const status = await readAppUpdateStatus({ runCommand: run, appRootPath });

  assert.equal(status.currentVersion, "0.8.2");
  // 0.8.10 must beat 0.9.0 only if compared numerically; it must not.
  assert.equal(status.latestVersion, "0.9.0");
  assert.equal(status.updateAvailable, true);
  assert.equal(status.error, null);
});

test("orders versions numerically rather than lexically", async () => {
  const appRootPath = await createAppRoot("0.8.9");
  const { run } = createRunner([{ stdout: tagRefs("v0.8.9", "v0.8.10") }]);

  const status = await readAppUpdateStatus({ runCommand: run, appRootPath });

  assert.equal(status.latestVersion, "0.8.10");
  assert.equal(status.updateAvailable, true);
});

test("treats a prerelease as older than its final release", async () => {
  const appRootPath = await createAppRoot("1.0.0");
  const { run } = createRunner([{ stdout: tagRefs("v1.0.0-rc.1", "v1.0.0") }]);

  const status = await readAppUpdateStatus({ runCommand: run, appRootPath });

  assert.equal(status.latestVersion, "1.0.0");
  assert.equal(status.updateAvailable, false);
});

test("reports no update when the local version already matches the newest tag", async () => {
  const appRootPath = await createAppRoot("0.9.0");
  const { run } = createRunner([{ stdout: tagRefs("v0.9.0") }]);

  const status = await readAppUpdateStatus({ runCommand: run, appRootPath });

  assert.equal(status.updateAvailable, false);
  assert.equal(status.error, null);
});

test("explains a checkout that is not a Git repository without running any command", async () => {
  const appRootPath = await createAppRoot("0.8.2", false);
  const { run, calls } = createRunner([]);

  const status = await readAppUpdateStatus({ runCommand: run, appRootPath });

  assert.equal(status.updateAvailable, false);
  assert.match(status.error ?? "", /not running from a Git checkout/);
  assert.deepEqual(calls, []);
});

test("surfaces an ls-remote failure instead of claiming no update exists", async () => {
  const appRootPath = await createAppRoot("0.8.2");
  const { run } = createRunner([{ ok: false, output: "fatal: could not read from remote" }]);

  const status = await readAppUpdateStatus({ runCommand: run, appRootPath });

  assert.equal(status.latestVersion, null);
  assert.equal(status.updateAvailable, false);
  assert.match(status.error ?? "", /could not read from remote/);
});

test("reports missing semver tags distinctly from a failed lookup", async () => {
  const appRootPath = await createAppRoot("0.8.2");
  const { run } = createRunner([{ stdout: "abc\trefs/tags/nightly\ndef\trefs/tags/latest" }]);

  const status = await readAppUpdateStatus({ runCommand: run, appRootPath });

  assert.equal(status.latestVersion, null);
  assert.match(status.error ?? "", /No semver release tags/);
});

test("falls back to 0.0.0 when package.json is unreadable, so an update is still offered", async () => {
  const appRootPath = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-update-"));
  await fs.mkdir(path.join(appRootPath, ".git"));
  await fs.writeFile(path.join(appRootPath, "package.json"), "{ not json", "utf8");
  const { run } = createRunner([{ stdout: tagRefs("v0.1.0") }]);

  const status = await readAppUpdateStatus({ runCommand: run, appRootPath });

  assert.equal(status.currentVersion, "0.0.0");
  assert.equal(status.updateAvailable, true);
});

test("runs fetch, pull and install in order and schedules a restart on success", async () => {
  const appRootPath = await createAppRoot("0.8.2");
  const { run, calls } = createRunner([
    { stdout: tagRefs("v0.9.0") },  // ls-remote via readAppUpdateStatus
    { stdout: "" },                 // status --porcelain (clean)
    { stdout: "fetched" },          // fetch
    { stdout: "pulled" },           // pull
    { stdout: "installed" }         // npm install
  ]);

  const result = await updateApplication({ runCommand: run, appRootPath });

  assert.equal(result.ok, true);
  assert.equal(result.restartScheduled, true);
  assert.deepEqual(calls.slice(2).map((call) => call.args), [
    ["fetch", "--tags", "origin"],
    ["pull", "--ff-only"],
    ["install"]
  ]);
});

test("refuses to update a dirty checkout and names the offending files", async () => {
  const appRootPath = await createAppRoot("0.8.2");
  const { run, calls } = createRunner([
    { stdout: tagRefs("v0.9.0") },
    { stdout: " M apps/server/src/server.ts\n?? scratch.txt\n" }
  ]);

  const result = await updateApplication({ runCommand: run, appRootPath });

  assert.equal(result.ok, false);
  assert.equal(result.restartScheduled, false);
  assert.match(result.output, /local changes/);
  assert.match(result.output, /scratch\.txt/);
  // Nothing beyond the status check may run.
  assert.equal(calls.length, 2);
});

test("does not touch the checkout when no newer release exists", async () => {
  const appRootPath = await createAppRoot("0.9.0");
  const { run, calls } = createRunner([{ stdout: tagRefs("v0.9.0") }]);

  const result = await updateApplication({ runCommand: run, appRootPath });

  assert.equal(result.ok, false);
  assert.equal(result.restartScheduled, false);
  assert.match(result.output, /No newer release available/);
  assert.equal(calls.length, 1);
});

test("stops the sequence at the first failing step and does not schedule a restart", async () => {
  const appRootPath = await createAppRoot("0.8.2");
  const { run, calls } = createRunner([
    { stdout: tagRefs("v0.9.0") },
    { stdout: "" },
    { stdout: "fetched" },
    { ok: false, exitCode: 1, output: "fatal: not possible to fast-forward" }
  ]);

  const result = await updateApplication({ runCommand: run, appRootPath });

  assert.equal(result.ok, false);
  assert.equal(result.restartScheduled, false);
  assert.match(result.output, /fast-forward/);
  // npm install must not run after a failed pull.
  assert.equal(calls.length, 4);
  assert.ok(!calls.some((call) => call.args.includes("install")));
});

test("refuses to update when the checkout is not a Git repository", async () => {
  const appRootPath = await createAppRoot("0.8.2", false);
  const { run, calls } = createRunner([]);

  const result = await updateApplication({ runCommand: run, appRootPath });

  assert.equal(result.ok, false);
  assert.equal(result.restartScheduled, false);
  assert.match(result.output, /not running from a Git checkout/);
  assert.deepEqual(calls, []);
});
