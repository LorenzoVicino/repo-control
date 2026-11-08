import { z } from "zod";
import { commitMessageSchema, gitFilePathSchema, gitRefSchema, type GuardedGitResult } from "../gitActions.js";
import { readGitActivity, readGitDetails, readGitFileDiff } from "../gitService.js";
import { commandOutput, truncate } from "./format.js";
import { repositoryInput } from "./repositoryTools.js";
import { defineTool, ToolError } from "./types.js";

function guardedOutput(action: string, repository: string, outcome: GuardedGitResult) {
  if (outcome.status === "blocked") throw new ToolError(`${action} in ${repository} was refused: ${outcome.message}`);
  return commandOutput(action, repository, outcome.result);
}

export const gitLog = defineTool({
  name: "git_log",
  title: "Read commit history",
  description: "List recent commits of a repository, newest first, with short hash, author, date and refs.",
  effect: "read",
  inputShape: {
    repository: repositoryInput,
    limit: z.number().int().min(1).max(30).default(10).describe("How many commits to return."),
    offset: z.number().int().min(0).max(5000).default(0).describe("Skip this many commits, for paging.")
  },
  async run(runtime, input) {
    const { project, path } = await runtime.resolveRepository(input.repository);
    const activity = await readGitActivity(path, input.offset, input.limit);
    const lines = activity.commits.map(
      (commit) => `${commit.shortHash} ${commit.date.slice(0, 10)} ${commit.author}: ${commit.message}${commit.refs.length ? ` [${commit.refs.join(", ")}]` : ""}`
    );
    return {
      text: lines.length ? `${project.name}, commits ${input.offset + 1}–${input.offset + lines.length}:\n${lines.join("\n")}` : `${project.name} has no commits in that range.`,
      data: activity
    };
  }
});

export const gitDiff = defineTool({
  name: "git_diff",
  title: "Read changes",
  description:
    "Without a path, summarize the uncommitted changes of a repository: staged and unstaged files with line counts, and untracked files. " +
    "With a path, return that file's patch. Large patches are truncated.",
  effect: "read",
  inputShape: {
    repository: repositoryInput,
    path: gitFilePathSchema.optional().describe("File path relative to the repository root."),
    staged: z.boolean().default(false).describe("With a path: read the staged version of the change instead of the working tree.")
  },
  async run(runtime, input) {
    const { project, path } = await runtime.resolveRepository(input.repository);

    if (input.path) {
      const diff = await readGitFileDiff(path, input.path, null, input.staged);
      const header = `${project.name}: ${input.path} (${input.staged ? "staged" : "unstaged"}), +${diff.additions} −${diff.deletions}`;
      return {
        text: diff.binary ? `${header}, binary file.` : `${header}\n${truncate(diff.patch) || "(no changes)"}`,
        data: { ...diff, patch: truncate(diff.patch) }
      };
    }

    const [unstaged, staged, untracked] = await Promise.all([
      runtime.runProjectCommand(path, "git", ["diff", "--stat", "--no-ext-diff"]),
      runtime.runProjectCommand(path, "git", ["diff", "--cached", "--stat", "--no-ext-diff"]),
      // `git diff` leaves new files out entirely, which reads as "nothing to commit".
      runtime.runProjectCommand(path, "git", ["ls-files", "--others", "--exclude-standard"])
    ]);
    const newFiles = untracked.stdout.split("\n").filter(Boolean);
    const section = (label: string, output: string) => `${label}:\n${output.trim() || "  none"}`;
    const untrackedSection = `Untracked (${newFiles.length}):\n${newFiles.slice(0, 40).map((file) => `  ${file}`).join("\n") || "  none"}`;
    return {
      text: truncate(`${project.name}\n${section("Staged", staged.stdout)}\n${section("Unstaged", unstaged.stdout)}\n${untrackedSection}`),
      data: { staged: truncate(staged.stdout), unstaged: truncate(unstaged.stdout), untracked: newFiles.slice(0, 200) }
    };
  }
});

export const listBranches = defineTool({
  name: "list_branches",
  title: "List branches",
  description: "List local branches (and optionally remote ones) with upstream, ahead/behind counts, merge state and latest commit.",
  effect: "read",
  inputShape: {
    repository: repositoryInput,
    includeRemote: z.boolean().default(false).describe("Also list remote-tracking branches.")
  },
  async run(runtime, input) {
    const { project, path } = await runtime.resolveRepository(input.repository);
    const { branches } = await readGitDetails(path);
    const listed = input.includeRemote ? [...branches.local, ...branches.remote] : branches.local;
    const lines = listed.map(
      (branch) =>
        `${branch.current ? "* " : "  "}${branch.name}${branch.upstream ? ` → ${branch.upstream}` : ""}` +
        `${branch.ahead || branch.behind ? ` (${branch.ahead} ahead, ${branch.behind} behind)` : ""}${branch.merged ? ", merged" : ""}` +
        `${branch.lastCommit ? `: ${branch.lastCommit.message}` : ""}`
    );
    return {
      text: `${project.name}, default branch ${branches.defaultBranch ?? "unknown"}:\n${lines.join("\n")}`,
      data: { current: branches.current, defaultBranch: branches.defaultBranch, branches: listed }
    };
  }
});

export const gitFetch = defineTool({
  name: "git_fetch",
  title: "Fetch from remotes",
  description: "Fetch all remotes and prune deleted branches, so ahead/behind counts are current. Does not change the working tree.",
  effect: "write",
  hints: { idempotent: true, openWorld: true },
  inputShape: { repository: repositoryInput },
  async run(runtime, input) {
    const { project, path } = await runtime.resolveRepository(input.repository);
    return commandOutput("git fetch", project.name, await runtime.git.fetch(path));
  }
});

export const gitPull = defineTool({
  name: "git_pull",
  title: "Pull (fast-forward only)",
  description:
    "Pull the current branch from its upstream, fast-forward only: it never creates a merge commit and fails instead if the branches diverged.",
  effect: "write",
  hints: { openWorld: true },
  inputShape: { repository: repositoryInput },
  async run(runtime, input) {
    const { project, path } = await runtime.resolveRepository(input.repository);
    return commandOutput("git pull --ff-only", project.name, await runtime.git.pull(path));
  }
});

export const gitPush = defineTool({
  name: "git_push",
  title: "Push",
  description:
    "Push the current branch's commits to its upstream. It is rejected when the upstream has commits the branch lacks; " +
    "pull first in that case. Never force-pushes.",
  effect: "write",
  hints: { openWorld: true },
  inputShape: { repository: repositoryInput },
  async run(runtime, input) {
    const { project, path } = await runtime.resolveRepository(input.repository);
    return commandOutput("git push", project.name, await runtime.git.push(path));
  }
});

export const gitCheckout = defineTool({
  name: "git_checkout",
  title: "Switch branch",
  description: "Switch to an existing branch. Refused while the working tree has uncommitted changes.",
  effect: "write",
  inputShape: {
    repository: repositoryInput,
    branch: gitRefSchema.describe("Branch name, e.g. main or origin/feature for a remote branch."),
    remote: z.boolean().default(false).describe("Create a local branch tracking this remote branch.")
  },
  async run(runtime, input) {
    const { project, path } = await runtime.resolveRepository(input.repository);
    return guardedOutput(`Switching to ${input.branch}`, project.name, await runtime.git.checkout(path, input.branch, input.remote));
  }
});

export const gitCreateBranch = defineTool({
  name: "git_create_branch",
  title: "Create branch",
  description: "Create a branch from the current commit and switch to it. Refused while the working tree has uncommitted changes.",
  effect: "write",
  inputShape: {
    repository: repositoryInput,
    branch: gitRefSchema.describe("Name of the new branch.")
  },
  async run(runtime, input) {
    const { project, path } = await runtime.resolveRepository(input.repository);
    return guardedOutput(`Creating ${input.branch}`, project.name, await runtime.git.createBranch(path, input.branch));
  }
});

export const gitCommit = defineTool({
  name: "git_commit",
  title: "Commit",
  description:
    "Commit the staged changes with a message. Set stageAll to stage every change first, including untracked files; " +
    "inspect the changes with git_diff before doing that.",
  effect: "write",
  inputShape: {
    repository: repositoryInput,
    message: commitMessageSchema.describe("Commit message, at most 500 characters."),
    stageAll: z.boolean().default(false).describe("Stage all changes, including untracked files, before committing.")
  },
  async run(runtime, input) {
    const { project, path } = await runtime.resolveRepository(input.repository);
    if (input.stageAll) {
      const staged = await runtime.git.stageAll(path);
      if (!staged.ok) return commandOutput("git add -A", project.name, staged);
    }
    return commandOutput("git commit", project.name, await runtime.git.commit(path, input.message));
  }
});

export const gitTools = [gitLog, gitDiff, listBranches, gitFetch, gitPull, gitPush, gitCheckout, gitCreateBranch, gitCommit];
