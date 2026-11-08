import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { Toolkit } from "../tools/index.js";
import type { RequestApproval } from "./access.js";

/** Name of the tool Claude Code calls, via --permission-prompt-tool, before a write tool runs. */
export const APPROVAL_TOOL_NAME = "approve";

// registerTool infers the callback's argument type from the input shape. Over a catalog
// typed with the general shape that inference never terminates (TS2589), and the toolkit
// validates input itself anyway, so the loop below uses this narrower view of the method.
type RegisterTool = (
  name: string,
  config: { title: string; description: string; inputSchema: z.ZodRawShape; annotations: ToolAnnotations },
  callback: (input: unknown) => Promise<CallToolResult>
) => unknown;

export type McpServerOptions = {
  toolkit: Toolkit;
  version: string;
  /** Write tools are not registered at all without this, so a client never sees them. */
  allowWrites: boolean;
  /** Present only for an in-app agent run: answers Claude Code's permission prompts. */
  requestApproval?: RequestApproval;
};

const INSTRUCTIONS =
  "repo-control manages the Git repositories in one local workspace folder. " +
  "Start with list_repositories (filter state=needs-attention to find work), name repositories by the names it returns, " +
  "and inspect a repository with get_repository or git_diff before changing it. " +
  "Write tools change repositories or containers on the user's machine; explain what a write will do before calling it.";

export function createMcpServer({ toolkit, version, allowWrites, requestApproval }: McpServerOptions): McpServer {
  const server = new McpServer({ name: "repo-control", title: "repo-control", version }, { instructions: INSTRUCTIONS });

  const registerTool = server.registerTool.bind(server) as unknown as RegisterTool;

  for (const tool of toolkit.tools) {
    if (tool.effect === "write" && !allowWrites) continue;

    registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputShape,
        annotations: {
          title: tool.title,
          readOnlyHint: tool.effect === "read",
          destructiveHint: tool.effect === "write" ? (tool.hints?.destructive ?? false) : undefined,
          idempotentHint: tool.effect === "write" ? (tool.hints?.idempotent ?? false) : undefined,
          openWorldHint: tool.hints?.openWorld ?? false
        }
      },
      // The SDK has already applied the shape; the toolkit validates again, strictly, so the
      // MCP path and the in-app agent share exactly one set of rules.
      async (input: unknown) => {
        const result = await toolkit.run(tool.name, input);
        return { content: [{ type: "text", text: result.text }], isError: result.isError };
      }
    );
  }

  if (requestApproval) registerApprovalTool(registerTool, toolkit, requestApproval);

  return server;
}

// The permission prompt tool contract of Claude Code: it receives the tool the model wants to
// call and its input, and answers with JSON text, {"behavior":"allow","updatedInput":...} or
// {"behavior":"deny","message":...}. Only catalog write tools should ever reach it, because
// read tools are pre-allowed and built-in tools are disabled; anything else is refused.
function registerApprovalTool(registerTool: RegisterTool, toolkit: Toolkit, requestApproval: RequestApproval): void {
  const writeTools = new Map(toolkit.tools.filter((tool) => tool.effect === "write").map((tool) => [`mcp__repo-control__${tool.name}`, tool.name]));

  registerTool(
    APPROVAL_TOOL_NAME,
    {
      title: "Ask the user for approval",
      description: "Used by repo-control to ask the user before a tool changes something. Never call it yourself.",
      inputSchema: {
        tool_name: z.string().max(200),
        input: z.record(z.unknown()).default({}),
        tool_use_id: z.string().max(200).optional()
      },
      annotations: { title: "Ask the user for approval", readOnlyHint: true, openWorldHint: false }
    },
    async (raw: unknown) => {
      const { tool_name: qualifiedName, input } = raw as { tool_name: string; input: Record<string, unknown> };
      const toolName = writeTools.get(qualifiedName);
      const decision = toolName
        ? await requestApproval({ toolName, input })
        : ({ behavior: "deny", message: `${qualifiedName} is not a repo-control action this agent may run.` } as const);
      const payload = decision.behavior === "allow" ? { behavior: "allow", updatedInput: input } : decision;
      return { content: [{ type: "text", text: JSON.stringify(payload) }] };
    }
  );
}
