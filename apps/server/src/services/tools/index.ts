import { z, ZodError } from "zod";
import { scanProjects, type ProjectSummary } from "../../gitScanner.js";
import type { CommandRunner } from "../../lib/commandRunner.js";
import type { ProjectResolver } from "../../lib/projectResolver.js";
import { createGitActions } from "../gitActions.js";
import { gitTools } from "./gitTools.js";
import { repositoryTools } from "./repositoryTools.js";
import { matchRepository } from "./repositoryRef.js";
import { ToolError, type ToolDefinition, type ToolResult, type ToolRuntime } from "./types.js";

export { ToolError } from "./types.js";
export type { ToolDefinition, ToolEffect, ToolOutput, ToolResult } from "./types.js";

// Docker, workflow and agent-session tools join this list in follow-up changes.
export const TOOL_CATALOG: ReadonlyArray<ToolDefinition> = [...repositoryTools, ...gitTools];

// A conversation calls several tools in a row; one scan per few seconds keeps that cheap
// without serving state that is visibly stale.
const SCAN_CACHE_MS = 3_000;

type ToolkitDependencies = Pick<ProjectResolver, "getActiveRootPath" | "resolveProjectPath"> & {
  runProjectCommand: CommandRunner;
  scan?: (rootPath: string) => Promise<ProjectSummary[]>;
  now?: () => number;
};

export type Toolkit = ReturnType<typeof createToolkit>;

export function createToolkit({ getActiveRootPath, resolveProjectPath, runProjectCommand, scan = (root) => scanProjects(root), now = Date.now }: ToolkitDependencies) {
  let cache: { rootPath: string; at: number; projects: Promise<ProjectSummary[]> } | null = null;

  function listRepositories(): Promise<ProjectSummary[]> {
    const rootPath = getActiveRootPath();
    if (!cache || cache.rootPath !== rootPath || now() - cache.at > SCAN_CACHE_MS) {
      const projects = scan(rootPath);
      cache = { rootPath, at: now(), projects };
      projects.catch(() => {
        if (cache?.projects === projects) cache = null;
      });
    }
    return cache.projects;
  }

  const runtime: ToolRuntime = {
    rootPath: getActiveRootPath,
    listRepositories,
    runProjectCommand,
    git: createGitActions({ run: runProjectCommand }),
    async resolveRepository(reference) {
      const project = matchRepository(await listRepositories(), getActiveRootPath(), reference);
      // Revalidate through the resolver: the scan result is a hint, the boundary check is the authority.
      return { project, path: await resolveProjectPath(project.id) };
    }
  };

  async function run(name: string, rawInput: unknown): Promise<ToolResult> {
    const tool = TOOL_CATALOG.find((candidate) => candidate.name === name);
    if (!tool) return { isError: true, text: `Unknown tool "${name}".` };

    const parsed = z.object(tool.inputShape).strict().safeParse(rawInput ?? {});
    if (!parsed.success) return { isError: true, text: `Invalid input for ${name}: ${formatZodError(parsed.error)}` };

    try {
      const output = await tool.run(runtime, parsed.data);
      if (tool.effect === "write") cache = null;
      return { isError: false, ...output };
    } catch (error) {
      if (error instanceof ToolError) return { isError: true, text: error.message };
      throw error;
    }
  }

  return { tools: TOOL_CATALOG, run, runtime };
}

function formatZodError(error: ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; ");
}
