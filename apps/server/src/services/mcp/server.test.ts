import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { runProjectCommand, runShellCommand } from "../../lib/commandRunner.js";
import { createProjectResolver } from "../../lib/projectResolver.js";
import { createToolkit, TOOL_CATALOG } from "../tools/index.js";
import { createMcpServer } from "./server.js";

const execFileAsync = promisify(execFile);

async function connect(allowWrites: boolean, rootPath = os.tmpdir()) {
  const toolkit = createToolkit({ ...createProjectResolver(rootPath), runProjectCommand, runShellCommand });
  const server = createMcpServer({ toolkit, version: "9.9.9", allowWrites });
  const client = new Client({ name: "repo-control-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, close: () => Promise.all([client.close(), server.close()]) };
}

test("a read-only server lists only read tools, annotated as read-only", async (context) => {
  const { client, close } = await connect(false);
  context.after(close);

  assert.deepEqual(client.getServerVersion(), { name: "repo-control", title: "repo-control", version: "9.9.9" });
  assert.match(client.getInstructions() ?? "", /list_repositories/);

  const { tools } = await client.listTools();
  const readTools = TOOL_CATALOG.filter((tool) => tool.effect === "read").map((tool) => tool.name);
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [...readTools].sort());
  for (const tool of tools) {
    assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} is read-only`);
    assert.equal(tool.inputSchema.type, "object");
  }

  const gitLog = tools.find((tool) => tool.name === "git_log");
  assert.deepEqual(gitLog?.inputSchema.required, ["repository"], "defaulted fields are optional for the client");

  const hidden = await client.callTool({ name: "git_push", arguments: { repository: "atlas-api" } });
  assert.equal(hidden.isError, true, "a write tool that is not registered cannot be called");
});

test("with writes allowed every tool is listed and write tools carry behaviour hints", async (context) => {
  const { client, close } = await connect(true);
  context.after(close);

  const { tools } = await client.listTools();
  assert.equal(tools.length, TOOL_CATALOG.length);
  const byName = new Map(tools.map((tool) => [tool.name, tool.annotations]));
  assert.deepEqual(byName.get("git_fetch"), {
    title: "Fetch from remotes",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  });
  assert.equal(byName.get("run_workflow")?.destructiveHint, true, "a workflow can run any saved shell command");
  assert.equal(byName.get("git_commit")?.openWorldHint, false);
});

test("tool calls run through the toolkit and come back as text, including recoverable errors", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-mcp-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const repository = path.join(root, "atlas-api");
  await fs.mkdir(repository);
  for (const args of [
    ["init", "-b", "main"],
    ["config", "user.email", "tests@repo-control.local"],
    ["config", "user.name", "repo-control tests"],
    ["commit", "--allow-empty", "-m", "Initial commit"]
  ]) {
    await execFileAsync("git", args, { cwd: repository });
  }

  const { client, close } = await connect(false, root);
  context.after(close);

  const listed = await client.callTool({ name: "list_repositories", arguments: {} });
  assert.equal(listed.isError, false);
  assert.deepEqual(listed.content, [{ type: "text", text: "1 of 1 repositories.\n- atlas-api (atlas-api) on main, no upstream: clean and in sync" }]);

  const unknown = await client.callTool({ name: "git_log", arguments: { repository: "billing" } });
  assert.equal(unknown.isError, true);
  assert.match(JSON.stringify(unknown.content), /No repository called \\"billing\\"/);

  const invalid = await client.callTool({ name: "git_log", arguments: { repository: "atlas-api", limit: 999 } });
  assert.equal(invalid.isError, true, "the SDK rejects input outside the schema before the toolkit runs");
});
