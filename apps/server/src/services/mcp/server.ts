import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import type { Toolkit } from "../tools/index.js";

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
};

const INSTRUCTIONS =
  "repo-control manages the Git repositories in one local workspace folder. " +
  "Start with list_repositories (filter state=needs-attention to find work), name repositories by the names it returns, " +
  "and inspect a repository with get_repository or git_diff before changing it. " +
  "Write tools change repositories or containers on the user's machine; explain what a write will do before calling it.";

export function createMcpServer({ toolkit, version, allowWrites }: McpServerOptions): McpServer {
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

  return server;
}
