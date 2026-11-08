import assert from "node:assert/strict";
import os from "node:os";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import Fastify from "fastify";
import { readEnv } from "../config/env.js";
import { runProjectCommand, runShellCommand } from "../lib/commandRunner.js";
import { createProjectResolver } from "../lib/projectResolver.js";
import { createMcpAccessControl } from "../services/mcp/access.js";
import { createToolkit } from "../services/tools/index.js";
import { registerMcpRoutes } from "./mcpRoutes.js";

const TOKEN = "t".repeat(40);

async function startApp(options: { externalToken?: string; externalWrites?: boolean }) {
  const app = Fastify();
  await registerMcpRoutes(app, {
    toolkit: createToolkit({ ...createProjectResolver(os.tmpdir()), runProjectCommand, runShellCommand }),
    version: "9.9.9",
    mcpAccess: createMcpAccessControl({ externalToken: options.externalToken, externalWrites: options.externalWrites ?? false })
  });
  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  return { app, url: new URL(`${address}/mcp`) };
}

async function connectClient(url: URL, token: string) {
  const client = new Client({ name: "repo-control-test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { authorization: `Bearer ${token}` } } }));
  return client;
}

test("the MCP endpoint is off until a token is configured", async (context) => {
  const { app, url } = await startApp({});
  context.after(() => app.close());

  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "MCP_DISABLED");
});

test("requests without the right bearer token are refused before any MCP handling", async (context) => {
  const { app, url } = await startApp({ externalToken: TOKEN });
  context.after(() => app.close());

  for (const authorization of [undefined, "Bearer wrong-token", `Basic ${TOKEN}`, `Bearer ${TOKEN}x`]) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
    });
    assert.equal(response.status, 401, `${authorization ?? "no header"} is refused`);
    assert.equal(response.headers.get("www-authenticate"), 'Bearer realm="repo-control"');
  }

  const get = await fetch(url, { headers: { authorization: `Bearer ${TOKEN}` } });
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("allow"), "POST");
});

test("an MCP client with the token can list and call tools; writes follow the configuration", async (context) => {
  const readOnly = await startApp({ externalToken: TOKEN });
  context.after(() => readOnly.app.close());
  const client = await connectClient(readOnly.url, TOKEN);
  context.after(() => client.close());

  assert.equal(client.getServerVersion()?.version, "9.9.9");
  const { tools } = await client.listTools();
  assert.ok(tools.some((tool) => tool.name === "list_repositories"));
  assert.ok(!tools.some((tool) => tool.name === "git_push"), "external clients are read-only by default");

  const result = await client.callTool({ name: "get_workflow_run", arguments: { runId: "missing-run" } });
  assert.equal(result.isError, true);
  assert.deepEqual(result.content, [{ type: "text", text: 'No workflow run with id "missing-run".' }]);

  const writable = await startApp({ externalToken: TOKEN, externalWrites: true });
  context.after(() => writable.app.close());
  const writer = await connectClient(writable.url, TOKEN);
  context.after(() => writer.close());
  assert.ok((await writer.listTools()).tools.some((tool) => tool.name === "git_push"));
});

test("MCP settings are read from the environment with safe defaults", () => {
  const defaults = readEnv({});
  assert.equal(defaults.REPO_CONTROL_MCP_TOKEN, undefined);
  assert.equal(defaults.REPO_CONTROL_MCP_WRITE, false);

  assert.equal(readEnv({ REPO_CONTROL_MCP_TOKEN: "   " }).REPO_CONTROL_MCP_TOKEN, undefined, "a blank line in .env leaves MCP off");
  assert.equal(readEnv({ REPO_CONTROL_MCP_TOKEN: ` ${TOKEN} ` }).REPO_CONTROL_MCP_TOKEN, TOKEN);
  assert.throws(() => readEnv({ REPO_CONTROL_MCP_TOKEN: "short" }), /at least 32 characters/);
  assert.equal(readEnv({ REPO_CONTROL_MCP_WRITE: "on" }).REPO_CONTROL_MCP_WRITE, true);
  assert.equal(readEnv({ REPO_CONTROL_MCP_WRITE: "no" }).REPO_CONTROL_MCP_WRITE, false);
});
