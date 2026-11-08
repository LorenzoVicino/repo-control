import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readEnv } from "./config/env.js";
import { appVersion } from "./lib/appPaths.js";
import { runProjectCommand, runShellCommand } from "./lib/commandRunner.js";
import { createProjectResolver } from "./lib/projectResolver.js";
import { createMcpServer } from "./services/mcp/server.js";
import { createToolkit } from "./services/tools/index.js";

// `repo-control mcp`: the tool catalog over stdio, for an MCP client that starts
// repo-control itself (Claude Code, Claude Desktop, an IDE). stdout belongs to the
// protocol, so nothing in this path may print to it; diagnostics go to stderr.
export async function startMcpStdio(): Promise<void> {
  const env = readEnv();
  const resolver = createProjectResolver(env.REPO_CONTROL_ROOT);
  const toolkit = createToolkit({ ...resolver, runProjectCommand, runShellCommand });
  const server = createMcpServer({ toolkit, version: appVersion, allowWrites: env.REPO_CONTROL_MCP_WRITE });

  await server.connect(new StdioServerTransport());
  console.error(
    `repo-control MCP server ready on stdio for ${resolver.getActiveRootPath()} (${env.REPO_CONTROL_MCP_WRITE ? "read and write tools" : "read-only tools"}).`
  );
}
