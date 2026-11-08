import path from "node:path";
import type { ProjectSummary } from "../../gitScanner.js";
import type { CommandResult } from "../../lib/commandRunner.js";

// Helpers that keep tool output compact. A model pays for every token it reads, so results
// carry what it needs to decide the next step and leave out absolute paths and noise.

export const MAX_TOOL_TEXT = 12_000;

export function truncate(text: string, limit = MAX_TOOL_TEXT): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n… truncated (${text.length - limit} more characters) …`;
}

/** Truncates from the start, for command output where the end holds the outcome. */
export function tail(text: string, limit = 4_000): string {
  if (text.length <= limit) return text;
  return `… ${text.length - limit} earlier characters omitted …\n${text.slice(-limit)}`;
}

/** "1 workflow", "3 workflows". */
export function count(amount: number, noun: string, plural = `${noun}s`): string {
  return `${amount} ${amount === 1 ? noun : plural}`;
}

export function relativePath(rootPath: string, absolutePath: string): string {
  return (path.relative(rootPath, absolutePath) || ".").replace(/\\/g, "/");
}

export function describeState(project: ProjectSummary): string {
  const parts: string[] = [];
  if (project.staged) parts.push(`${project.staged} staged`);
  if (project.modified) parts.push(`${project.modified} modified`);
  if (project.untracked) parts.push(`${project.untracked} untracked`);
  if (project.ahead) parts.push(`${project.ahead} ahead`);
  if (project.behind) parts.push(`${project.behind} behind`);
  return parts.length ? parts.join(", ") : "clean and in sync";
}

export function compactProject(rootPath: string, project: ProjectSummary) {
  return {
    id: project.id,
    name: project.name,
    relativePath: relativePath(rootPath, project.path),
    branch: project.branch,
    upstream: project.upstream,
    isClean: project.isClean,
    staged: project.staged,
    modified: project.modified,
    untracked: project.untracked,
    ahead: project.ahead,
    behind: project.behind,
    hasDockerCompose: project.hasDockerCompose,
    lastCommit: project.lastCommit
  };
}

export function commandOutput(action: string, repository: string, result: CommandResult) {
  const output = tail(result.output.trim());
  const status = result.ok ? "succeeded" : `failed (exit code ${result.exitCode ?? "none"})`;
  return {
    text: `${action} in ${repository} ${status}.${output ? `\n${output}` : ""}`,
    data: { ok: result.ok, exitCode: result.exitCode, command: result.command, output, durationMs: result.durationMs }
  };
}
