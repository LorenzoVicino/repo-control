import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  getDirtyCheckoutMessage,
  getGitPathArgs,
  isSafeGitPath,
  isSafeGitRef,
  normalizeRemoteBranch,
  readGitActivity,
  readGitDetails,
  readGitFileDiff
} from "./gitService.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

async function commitFile(repositoryPath: string, name: string, content: string, message: string): Promise<void> {
  await fs.writeFile(path.join(repositoryPath, name), content, "utf8");
  await git(repositoryPath, "add", name);
  await git(repositoryPath, "commit", "-m", message);
}

test("reads Git details, changes, branches, stashes and paginated activity from a real repository", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-git-service-"));
  const repositoryPath = path.join(temporaryRoot, "project");
  const remotePath = path.join(temporaryRoot, "remote.git");
  await fs.mkdir(repositoryPath);

  try {
    await git(repositoryPath, "init", "-b", "main");
    await git(repositoryPath, "config", "user.email", "tests@repo-control.local");
    await git(repositoryPath, "config", "user.name", "repo-control tests");
    for (const name of ["staged.ts", "modified.ts", "deleted.ts", "old-name.ts", "conflict.txt"]) {
      await fs.writeFile(path.join(repositoryPath, name), `${name} initial\n`, "utf8");
    }
    await git(repositoryPath, "add", "-A");
    await git(repositoryPath, "commit", "-m", "initial");
    await commitFile(repositoryPath, "activity-one.txt", "one\n", "activity one");
    await commitFile(repositoryPath, "activity-two.txt", "two\n", "activity two");

    await fs.writeFile(path.join(repositoryPath, "stash-only.txt"), "stash\n", "utf8");
    await git(repositoryPath, "stash", "push", "-u", "-m", "saved work");

    await git(temporaryRoot, "init", "--bare", remotePath);
    await git(repositoryPath, "remote", "add", "origin", remotePath);
    await git(repositoryPath, "push", "-u", "origin", "main");
    await git(repositoryPath, "branch", "feature/local");
    await git(repositoryPath, "push", "origin", "feature/local");

    const cleanDetails = await readGitDetails(repositoryPath);
    assert.equal(cleanDetails.status.current, "main");
    assert.equal(cleanDetails.status.detached, false);
    assert.equal(cleanDetails.status.isClean, true);
    assert.equal(cleanDetails.status.tracking, "origin/main");
    assert.ok(cleanDetails.branches.local.some((branch) => branch.name === "main" && branch.current));
    assert.ok(cleanDetails.branches.local.some((branch) => branch.name === "feature/local" && branch.merged));
    assert.ok(cleanDetails.branches.local.every((branch) => branch.lastCommit?.hash));
    assert.ok(cleanDetails.branches.remote.some((branch) => branch.name === "origin/feature/local" && branch.remote));
    assert.equal(cleanDetails.stashes[0]?.index, 0);
    assert.match(cleanDetails.stashes[0]?.message ?? "", /saved work/);
    assert.equal(await getDirtyCheckoutMessage(repositoryPath), null);

    await fs.appendFile(path.join(repositoryPath, "staged.ts"), "staged\n", "utf8");
    await git(repositoryPath, "add", "staged.ts");
    await fs.appendFile(path.join(repositoryPath, "modified.ts"), "modified\n", "utf8");
    await fs.rm(path.join(repositoryPath, "deleted.ts"));
    await git(repositoryPath, "mv", "old-name.ts", "new-name.ts");
    await fs.writeFile(path.join(repositoryPath, "untracked.ts"), "new\n", "utf8");

    const dirtyDetails = await readGitDetails(repositoryPath);
    assert.equal(dirtyDetails.status.isClean, false);
    assert.ok(dirtyDetails.status.files.staged.some((change) => change.path === "staged.ts" && change.label === "staged"));
    assert.ok(dirtyDetails.status.files.unstaged.some((change) => change.path === "modified.ts" && change.label === "modified"));
    assert.ok(dirtyDetails.status.files.unstaged.some((change) => change.path === "deleted.ts" && change.label === "deleted"));
    assert.ok(dirtyDetails.status.files.unstaged.some((change) => change.path === "new-name.ts" && change.previousPath === "old-name.ts"));
    assert.ok(dirtyDetails.status.files.unstaged.some((change) => change.path === "untracked.ts" && change.label === "untracked"));
    assert.equal(dirtyDetails.status.diff.staged.additions >= 1, true);
    assert.equal(dirtyDetails.status.diff.unstaged.deletions >= 1, true);
    assert.equal(dirtyDetails.status.diff.unstaged.untrackedFiles, 1);
    const stagedDiff = await readGitFileDiff(repositoryPath, "staged.ts", null, true);
    assert.equal(stagedDiff.staged, true);
    assert.match(stagedDiff.patch, /\+staged/);
    assert.equal(stagedDiff.additions, 1);
    const untrackedDiff = await readGitFileDiff(repositoryPath, "untracked.ts", null, false);
    assert.match(untrackedDiff.patch, /new file mode/);
    assert.match(untrackedDiff.patch, /\+new/);
    assert.equal(untrackedDiff.additions, 1, "a one-line file with a final newline is one added line");
    assert.match(await getDirtyCheckoutMessage(repositoryPath) ?? "", /Checkout blocked/);

    await git(repositoryPath, "reset", "--hard", "HEAD");
    await git(repositoryPath, "clean", "-fd");
    const firstPage = await readGitActivity(repositoryPath, 0, 2);
    assert.equal(firstPage.commits.length, 2);
    assert.equal(firstPage.hasMore, true);
    assert.equal(firstPage.nextOffset, 2);
    assert.ok(firstPage.commits[0]?.hash.length === 40);
    assert.ok(firstPage.commits[0]?.refs.length <= 4);
    const lastPage = await readGitActivity(repositoryPath, 2, 20);
    assert.equal(lastPage.hasMore, false);
    assert.equal(lastPage.nextOffset, null);
    const emptyRepository = path.join(temporaryRoot, "empty");
    await fs.mkdir(emptyRepository);
    const emptyLog = await readGitActivity(emptyRepository, 0, 8);
    assert.deepEqual(emptyLog.commits, []);

    const head = await git(repositoryPath, "rev-parse", "HEAD");
    await git(repositoryPath, "checkout", "--detach", head);
    const detached = await readGitDetails(repositoryPath);
    assert.equal(detached.status.current, "(detached)");
    assert.equal(detached.status.detached, true);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("validates Git refs and relative paths used by mutation routes", () => {
  for (const valid of ["main", "feature/test-1", "release_1.2", "origin/main", "a.b"]) {
    assert.equal(isSafeGitRef(valid), true, valid);
  }
  for (const invalid of ["", "-main", "/main", "main/", "main.", "a//b", "a..b", "stash@{0}", "x.lock", "hello world", "$(bad)"]) {
    assert.equal(isSafeGitRef(invalid), false, invalid);
  }
  for (const valid of ["src/index.ts", "folder\\file.ts", "README.md"]) {
    assert.equal(isSafeGitPath(valid), true, valid);
  }
  for (const invalid of ["/etc/passwd", "C:\\Windows\\system.ini", "\\\\server\\share\\file", "../secret", "src/../secret", "./file", "src//file", "src\\\\file", "bad\0file", "bad\nfile", "bad\rfile"]) {
    assert.equal(isSafeGitPath(invalid), false, JSON.stringify(invalid));
  }
  assert.equal(normalizeRemoteBranch("remotes/origin/main"), "origin/main");
  assert.equal(normalizeRemoteBranch("origin/main"), "origin/main");
  assert.deepEqual(getGitPathArgs("new.ts", "old.ts"), ["--", "old.ts", "new.ts"]);
  assert.deepEqual(getGitPathArgs("new.ts", null), ["--", "new.ts"]);
  assert.deepEqual(getGitPathArgs("new.ts", undefined), ["--", "new.ts"]);
});

test("a new file's patch matches git: final newline, missing newline and empty file", async () => {
  const { untrackedFilePatch } = await import("./gitService.js");
  const header = "diff --git a/a.txt b/a.txt\nnew file mode 100644\n--- /dev/null\n+++ b/a.txt";
  assert.equal(untrackedFilePatch("a.txt", "one\n"), `${header}\n@@ -0,0 +1 @@\n+one`);
  assert.equal(untrackedFilePatch("a.txt", "one\ntwo\n"), `${header}\n@@ -0,0 +1,2 @@\n+one\n+two`);
  assert.equal(untrackedFilePatch("a.txt", "one\ntwo"), `${header}\n@@ -0,0 +1,2 @@\n+one\n+two\n\\ No newline at end of file`);
  assert.equal(untrackedFilePatch("a.txt", "\n"), `${header}\n@@ -0,0 +1 @@\n+`);
  assert.equal(untrackedFilePatch("a.txt", ""), header);
});
