import assert from "node:assert/strict";
import test from "node:test";
import type { CommandResult, CommandRunner } from "../lib/commandRunner.js";
import { commitMessageSchema, createGitActions, gitFilePathSchema, gitRefSchema, gitStashRefSchema } from "./gitActions.js";

type Call = { cwd: string; command: string; args: string[]; timeoutMs?: number };

function recordingRunner(): { run: CommandRunner; calls: Call[] } {
  const calls: Call[] = [];
  const run: CommandRunner = async (cwd, command, args, timeoutMs) => {
    calls.push({ cwd, command, args, timeoutMs });
    const result: CommandResult = { ok: true, command: [command, ...args].join(" "), exitCode: 0, stdout: "", stderr: "", output: "", durationMs: 1 };
    return result;
  };
  return { run, calls };
}

test("maps each Git action to the exact command it has always run", async () => {
  const { run, calls } = recordingRunner();
  const actions = createGitActions({ run, now: () => new Date("2026-11-08T10:00:00.000Z") });
  const repo = "/workspace/alpha";

  await actions.fetch(repo);
  await actions.pull(repo);
  await actions.pullDevelop(repo);
  await actions.push(repo);
  await actions.stageAll(repo);
  await actions.stage(repo, "src/new.ts", "src/old.ts");
  await actions.unstageAll(repo);
  await actions.unstage(repo, "README.md");
  await actions.commit(repo, "Fix the parser");
  await actions.stash(repo);
  await actions.stash(repo, "before rebase");
  await actions.stashPop(repo, "stash@{1}");

  assert.ok(calls.every((call) => call.cwd === repo && call.command === "git"));
  assert.deepEqual(
    calls.map((call) => call.args),
    [
      ["fetch", "--all", "--prune"],
      ["pull", "--ff-only"],
      ["pull", "origin", "develop"],
      ["push"],
      ["add", "-A"],
      ["add", "-A", "--", "src/old.ts", "src/new.ts"],
      ["reset"],
      ["reset", "--", "README.md"],
      ["commit", "-m", "Fix the parser"],
      ["stash", "push", "-u", "-m", "repo-control stash 2026-11-08T10:00:00.000Z"],
      ["stash", "push", "-u", "-m", "before rebase"],
      ["stash", "pop", "stash@{1}"]
    ]
  );
  assert.equal(calls[2].timeoutMs, 300_000, "pulling another branch gets the network timeout");
  assert.equal(calls[3].timeoutMs, 300_000, "push gets the network timeout");
  assert.equal(calls[0].timeoutMs, undefined);
});

test("refuses to switch or create a branch on a dirty working tree without running Git", async () => {
  const { run, calls } = recordingRunner();
  const actions = createGitActions({ run, getDirtyCheckoutMessage: async () => "Checkout blocked: commit first." });

  assert.deepEqual(await actions.checkout("/repo", "main"), { status: "blocked", message: "Checkout blocked: commit first." });
  assert.deepEqual(await actions.createBranch("/repo", "feature/x"), { status: "blocked", message: "Checkout blocked: commit first." });
  assert.equal(calls.length, 0);
});

test("switches local and remote branches and creates new ones on a clean tree", async () => {
  const { run, calls } = recordingRunner();
  const actions = createGitActions({ run, getDirtyCheckoutMessage: async () => null });

  const local = await actions.checkout("/repo", "main");
  await actions.checkout("/repo", "remotes/origin/feature", true);
  await actions.createBranch("/repo", "feature/new");

  assert.equal(local.status, "done");
  assert.deepEqual(
    calls.map((call) => call.args),
    [
      ["switch", "main"],
      ["switch", "--track", "origin/feature"],
      ["checkout", "-b", "feature/new"]
    ]
  );
});

test("exported schemas reject unsafe refs, paths, stash references and empty messages", () => {
  assert.equal(gitRefSchema.safeParse("feature/ok").success, true);
  assert.equal(gitRefSchema.safeParse("--upload-pack=evil").success, false);
  assert.equal(gitFilePathSchema.safeParse("src/index.ts").success, true);
  assert.equal(gitFilePathSchema.safeParse("").success, false);
  assert.equal(gitStashRefSchema.safeParse("stash@{2}").success, true);
  assert.equal(gitStashRefSchema.safeParse("HEAD~1").success, false);
  assert.equal(commitMessageSchema.safeParse("   ").success, false);
  assert.equal(commitMessageSchema.parse("  Ship it  "), "Ship it");
});
