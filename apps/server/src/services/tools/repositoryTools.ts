import { z } from "zod";
import { readGitActivity, readGitDetails } from "../gitService.js";
import { compactProject, describeState, relativePath } from "./format.js";
import { defineTool } from "./types.js";

export const repositoryInput = z
  .string()
  .min(1)
  .max(500)
  .describe('Repository name (e.g. "atlas-api"), path relative to the workspace, or the id from list_repositories.');

const STATE_FILTERS = ["any", "needs-attention", "dirty", "clean", "ahead", "behind"] as const;
const MAX_LISTED_FILES = 40;

export const listRepositories = defineTool({
  name: "list_repositories",
  title: "List repositories",
  description:
    "List the Git repositories in the active workspace with branch, upstream and working-tree state. " +
    "Filter by state to find what needs attention: dirty (uncommitted changes), ahead (commits to push), " +
    "behind (commits to pull) or needs-attention (any of those).",
  effect: "read",
  inputShape: {
    state: z.enum(STATE_FILTERS).default("any").describe("Only return repositories in this state."),
    query: z.string().max(200).optional().describe("Case-insensitive substring of the repository name or path.")
  },
  async run(runtime, input) {
    const rootPath = runtime.rootPath();
    const query = input.query?.trim().toLowerCase();
    const all = await runtime.listRepositories();
    const matches = all.filter((project) => {
      if (query && !`${project.name} ${relativePath(rootPath, project.path)}`.toLowerCase().includes(query)) return false;
      switch (input.state) {
        case "dirty":
          return !project.isClean;
        case "clean":
          return project.isClean && project.ahead === 0 && project.behind === 0;
        case "ahead":
          return project.ahead > 0;
        case "behind":
          return project.behind > 0;
        case "needs-attention":
          return !project.isClean || project.ahead > 0 || project.behind > 0;
        default:
          return true;
      }
    });

    const lines = matches.map(
      (project) =>
        `- ${project.name} (${relativePath(rootPath, project.path)}) on ${project.branch}` +
        `${project.upstream ? ` → ${project.upstream}` : ", no upstream"}: ${describeState(project)}`
    );
    const heading = `${matches.length} of ${all.length} repositories${input.state === "any" ? "" : ` (${input.state})`}.`;

    return {
      text: lines.length ? `${heading}\n${lines.join("\n")}` : heading,
      data: { total: all.length, repositories: matches.map((project) => compactProject(rootPath, project)) }
    };
  }
});

export const getRepository = defineTool({
  name: "get_repository",
  title: "Inspect a repository",
  description:
    "Show one repository in detail: branch and upstream, staged and unstaged files, local branches, " +
    "stashes and the five most recent commits. Use it before proposing any change to that repository.",
  effect: "read",
  inputShape: { repository: repositoryInput },
  async run(runtime, input) {
    const { project, path: projectPath } = await runtime.resolveRepository(input.repository);
    const [details, activity] = await Promise.all([readGitDetails(projectPath), readGitActivity(projectPath, 0, 5)]);
    const { files } = details.status;
    const fileLine = (file: { label: string; path: string }) => `  ${file.label} ${file.path}`;

    const text = [
      `${project.name} on ${details.status.current}${details.status.tracking ? ` → ${details.status.tracking}` : ", no upstream"}: ${describeState(project)}.`,
      files.staged.length ? `Staged (${files.staged.length}):\n${files.staged.slice(0, MAX_LISTED_FILES).map(fileLine).join("\n")}` : "Nothing staged.",
      files.unstaged.length
        ? `Unstaged (${files.unstaged.length}):\n${files.unstaged.slice(0, MAX_LISTED_FILES).map(fileLine).join("\n")}`
        : "No unstaged changes.",
      `Local branches: ${details.branches.local.map((branch) => (branch.current ? `*${branch.name}` : branch.name)).join(", ") || "none"}` +
        `${details.branches.defaultBranch ? ` (default ${details.branches.defaultBranch})` : ""}.`,
      details.stashes.length ? `Stashes: ${details.stashes.map((stash) => `${stash.ref} ${stash.message}`).join("; ")}.` : "No stashes.",
      project.hasDockerCompose ? "Has a Docker Compose file." : "",
      `Recent commits:\n${activity.commits.map((commit) => `  ${commit.shortHash} ${commit.message} (${commit.author})`).join("\n") || "  none"}`
    ]
      .filter(Boolean)
      .join("\n");

    return {
      text,
      data: {
        repository: compactProject(runtime.rootPath(), project),
        files: { staged: files.staged.slice(0, MAX_LISTED_FILES), unstaged: files.unstaged.slice(0, MAX_LISTED_FILES) },
        diff: details.status.diff,
        branches: { current: details.branches.current, defaultBranch: details.branches.defaultBranch, local: details.branches.local.map((branch) => branch.name) },
        stashes: details.stashes,
        recentCommits: activity.commits
      }
    };
  }
});

export const repositoryTools = [listRepositories, getRepository];
