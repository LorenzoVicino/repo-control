import { z } from "zod";
import type { CommandResult, CommandRunner } from "../lib/commandRunner.js";
import {
  getDirtyCheckoutMessage,
  getGitPathArgs,
  isSafeGitPath,
  isSafeGitRef,
  normalizeRemoteBranch
} from "./gitService.js";

// Git operations that change a repository. The HTTP routes and the agent tool layer both
// call these, so validation and the dirty-checkout guard live in one place. Every action
// takes a project path that the caller has already resolved through the project resolver;
// nothing here accepts a client-provided directory.

const NETWORK_TIMEOUT_MS = 1000 * 60 * 5;

export const gitRefSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(isSafeGitRef, "Invalid branch name");

export const gitFilePathSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine(isSafeGitPath, "Invalid Git file path");

export const gitStashRefSchema = z.string().regex(/^stash@\{\d+\}$/, "Invalid stash reference");

export const commitMessageSchema = z.string().trim().min(1).max(500);

export const stashMessageSchema = z.string().trim().max(200);

/** Result of an action that refuses to run on a dirty working tree. */
export type GuardedGitResult =
  | { status: "done"; result: CommandResult }
  | { status: "blocked"; message: string };

export type GitActions = ReturnType<typeof createGitActions>;

type GitActionsDependencies = {
  run: CommandRunner;
  getDirtyCheckoutMessage?: (projectPath: string) => Promise<string | null>;
  now?: () => Date;
};

export function createGitActions({
  run,
  getDirtyCheckoutMessage: dirtyCheck = getDirtyCheckoutMessage,
  now = () => new Date()
}: GitActionsDependencies) {
  const git = (projectPath: string, args: string[], timeoutMs?: number) => run(projectPath, "git", args, timeoutMs);

  async function guarded(projectPath: string, args: string[]): Promise<GuardedGitResult> {
    const message = await dirtyCheck(projectPath);
    if (message) return { status: "blocked", message };
    return { status: "done", result: await git(projectPath, args) };
  }

  return {
    fetch: (projectPath: string) => git(projectPath, ["fetch", "--all", "--prune"]),

    /** Fast-forward only, so a pull can never create a merge commit on the user's behalf. */
    pull: (projectPath: string) => git(projectPath, ["pull", "--ff-only"]),

    pullDevelop: (projectPath: string) => git(projectPath, ["pull", "origin", "develop"], NETWORK_TIMEOUT_MS),

    push: (projectPath: string) => git(projectPath, ["push"], NETWORK_TIMEOUT_MS),

    stageAll: (projectPath: string) => git(projectPath, ["add", "-A"]),

    stage: (projectPath: string, filePath: string, previousPath?: string | null) =>
      git(projectPath, ["add", "-A", ...getGitPathArgs(filePath, previousPath)]),

    unstageAll: (projectPath: string) => git(projectPath, ["reset"]),

    unstage: (projectPath: string, filePath: string, previousPath?: string | null) =>
      git(projectPath, ["reset", ...getGitPathArgs(filePath, previousPath)]),

    commit: (projectPath: string, message: string) => git(projectPath, ["commit", "-m", message]),

    stash: (projectPath: string, message?: string) =>
      git(projectPath, ["stash", "push", "-u", "-m", message || `repo-control stash ${now().toISOString()}`]),

    stashPop: (projectPath: string, ref: string) => git(projectPath, ["stash", "pop", ref]),

    checkout: (projectPath: string, branch: string, remote = false) =>
      guarded(projectPath, remote ? ["switch", "--track", normalizeRemoteBranch(branch)] : ["switch", branch]),

    createBranch: (projectPath: string, branch: string) => guarded(projectPath, ["checkout", "-b", branch])
  };
}
