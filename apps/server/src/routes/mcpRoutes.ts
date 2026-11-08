import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { FastifyInstance } from "fastify";
import type { McpAccessControl } from "../services/mcp/access.js";
import { createMcpServer } from "../services/mcp/server.js";
import type { Toolkit } from "../services/tools/index.js";

type McpRoutesContext = {
  toolkit: Toolkit;
  version: string;
  mcpAccess: McpAccessControl;
};

// Streamable HTTP in stateless mode: every POST carries one JSON-RPC message and gets one
// JSON response, with a fresh server and transport per request. Tool calls are short and the
// catalog keeps no per-client state, so sessions and server-sent streams would only add
// lifecycle to manage.
export async function registerMcpRoutes(app: FastifyInstance, context: McpRoutesContext): Promise<void> {
  app.post("/mcp", async (request, reply) => {
    if (!context.mcpAccess.enabled()) {
      return reply.code(404).send({
        ok: false,
        code: "MCP_DISABLED",
        message: "The MCP endpoint is off. Set REPO_CONTROL_MCP_TOKEN to enable it."
      });
    }

    const access = context.mcpAccess.authorize(request.headers.authorization);

    if (!access) {
      return reply
        .code(401)
        .header("www-authenticate", 'Bearer realm="repo-control"')
        .send({ ok: false, code: "MCP_UNAUTHORIZED", message: "A valid bearer token is required." });
    }

    const server = createMcpServer({
      toolkit: context.toolkit,
      version: context.version,
      allowWrites: access.allowWrites,
      requestApproval: access.client === "agent" ? access.requestApproval : undefined
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });

    // The transport writes the response itself, so Fastify must not send one too.
    reply.hijack();
    reply.raw.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(request.raw, reply.raw, request.body);
    } catch (error) {
      request.log.error({ err: error }, "MCP request failed");
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { "content-type": "application/json" });
        reply.raw.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null }));
      }
    }
  });

  // Stateless mode has no server-initiated stream to open and no session to end.
  for (const method of ["GET", "DELETE"] as const) {
    app.route({
      method,
      url: "/mcp",
      handler: async (_request, reply) =>
        reply.code(405).header("allow", "POST").send({ ok: false, code: "METHOD_NOT_ALLOWED", message: "Use POST for MCP requests." })
    });
  }
}
