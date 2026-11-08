import type { z } from "zod";
import type { ProjectSummary } from "../../gitScanner.js";
import type { CommandRunner } from "../../lib/commandRunner.js";
import type { scanAgentSessions } from "../agentSessionService.js";
import type { GitActions } from "../gitActions.js";
import type { KnowledgeIndex } from "../knowledge/index.js";
import type { WorkflowExecutionContext } from "../workflow/types.js";

// The tool layer is what an agent can do in a workspace. Each tool is a plain definition:
// a name, a description written for a model, an input shape, and whether it only reads or
// also changes something. The MCP server and the in-app agent both consume this catalog,
// so a capability is described, validated and guarded exactly once.

/** `read` tools run freely; `write` tools change a repository and need explicit approval. */
export type ToolEffect = "read" | "write";

/** What a tool hands back: prose for the model and structured data for programs. */
export type ToolOutput = {
  text: string;
  data: unknown;
};

export type ToolResult = (ToolOutput & { isError: false }) | { isError: true; text: string };

export type ResolvedRepository = {
  project: ProjectSummary;
  path: string;
};

/** Services a tool may use. Every path comes from the project resolver, never from input. */
export type ToolRuntime = {
  rootPath: () => string;
  listRepositories: () => Promise<ProjectSummary[]>;
  resolveRepository: (reference: string) => Promise<ResolvedRepository>;
  git: GitActions;
  runProjectCommand: CommandRunner;
  /** What workflow runs execute with; its root and command runners match the ones above. */
  workflows: WorkflowExecutionContext;
  scanAgentSessions: typeof scanAgentSessions;
  /** The workspace knowledge index (labels and search); absent where it is not wired in. */
  knowledge?: () => KnowledgeIndex;
};

export type ToolDefinition<Shape extends z.ZodRawShape = z.ZodRawShape> = {
  name: string;
  title: string;
  description: string;
  effect: ToolEffect;
  /**
   * Behaviour hints for clients, mirroring MCP tool annotations. Defaults: not destructive,
   * not idempotent, and closed-world (only this machine is involved).
   */
  hints?: { destructive?: boolean; idempotent?: boolean; openWorld?: boolean };
  /** A zod raw shape, the form the MCP SDK accepts for a tool's input schema. */
  inputShape: Shape;
  // Method syntax on purpose: it keeps the parameter bivariant, so a tool with a specific
  // input shape can sit in a catalog typed with the general one. The registry validates
  // input against inputShape before calling run, which is what makes that safe.
  run(runtime: ToolRuntime, input: z.objectOutputType<Shape, z.ZodTypeAny>): Promise<ToolOutput>;
};

/** An expected failure the model should read and recover from, such as an unknown name. */
export class ToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolError";
  }
}

export function defineTool<Shape extends z.ZodRawShape>(definition: ToolDefinition<Shape>): ToolDefinition<Shape> {
  return definition;
}
