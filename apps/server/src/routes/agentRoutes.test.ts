import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import os from "node:os";
import { PassThrough } from "node:stream";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import Fastify from "fastify";
import { readEnv } from "../config/env.js";
import { runProjectCommand, runShellCommand } from "../lib/commandRunner.js";
import { createProjectResolver } from "../lib/projectResolver.js";
import type { AgentEvent } from "../services/agent/events.js";
import { createAgentRunner } from "../services/agent/runner.js";
import { createMcpAccessControl } from "../services/mcp/access.js";
import { createToolkit } from "../services/tools/index.js";
import { getLocalMcpUrl } from "../server.js";
import { registerAgentRoutes } from "./agentRoutes.js";
import { registerMcpRoutes } from "./mcpRoutes.js";

// Stands in for `claude -p`: it reads the MCP config it was given, asks repo-control's /mcp
// for approval exactly as Claude Code's --permission-prompt-tool does, and reports the
// answer in stream-json. Everything on the repo-control side is real.
type Script = (mcp: { approve: (toolName: string, input: Record<string, unknown>) => Promise<unknown> }, emit: (value: unknown) => void) => Promise<void>;

async function startApp(script: Script) {
  const app = Fastify();
  const toolkit = createToolkit({ ...createProjectResolver(os.tmpdir()), runProjectCommand, runShellCommand });
  const mcpAccess = createMcpAccessControl({ externalWrites: false });
  let mcpUrl = "";
  const tokens: string[] = [];

  const agentRunner = createAgentRunner({
    claudeCommand: "claude",
    mcpUrl: () => mcpUrl,
    mcpAccess,
    workspaceRoot: os.tmpdir,
    tools: toolkit.tools,
    killProcess: (child) => child.emit("close", 143),
    spawnProcess: (_command, args) => {
      const child = new EventEmitter() as ChildProcess;
      const stdout = new PassThrough();
      Object.assign(child, { stdout, stderr: new PassThrough(), stdin: new PassThrough() });
      const emit = (value: unknown) => stdout.write(`${JSON.stringify(value)}\n`);

      void (async () => {
        const config = JSON.parse(await fs.readFile(args[args.indexOf("--mcp-config") + 1], "utf8"));
        const server = config.mcpServers["repo-control"];
        tokens.push(server.headers.Authorization);
        const client = new Client({ name: "fake-claude", version: "1.0.0" });
        await client.connect(new StreamableHTTPClientTransport(new URL(server.url), { requestInit: { headers: server.headers } }));
        const approve = async (toolName: string, input: Record<string, unknown>) => {
          const result = await client.callTool({ name: "approve", arguments: { tool_name: `mcp__repo-control__${toolName}`, input, tool_use_id: "tu-1" } });
          return JSON.parse((result.content as Array<{ text: string }>)[0].text);
        };
        try {
          await script({ approve }, emit);
        } finally {
          await client.close();
          stdout.end();
          setImmediate(() => child.emit("close", 0));
        }
      })();
      return child;
    }
  });

  await registerMcpRoutes(app, { toolkit, version: "9.9.9", mcpAccess });
  await registerAgentRoutes(app, { agentRunner, agentStatus: async () => ({ available: true, command: "claude", model: null }) });
  const address = await app.listen({ host: "127.0.0.1", port: 0 });
  mcpUrl = `${address}/mcp`;
  return { app, base: address, tokens };
}

const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/** Reads the SSE stream, answering approval requests with `decide`, until the run ends. */
async function follow(base: string, runId: string, decide?: (event: AgentEvent) => unknown): Promise<AgentEvent[]> {
  const response = await fetch(`${base}/api/agent/runs/${runId}/events`);
  assert.equal(response.headers.get("content-type"), "text/event-stream; charset=utf-8");
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const events: AgentEvent[] = [];
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return events;
    buffer += decoder.decode(value, { stream: true });
    let boundary: number;
    while ((boundary = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (!frame.startsWith("id: ")) continue;
      const event = JSON.parse(frame.slice(frame.indexOf("data: ") + 6)) as AgentEvent;
      events.push(event);
      if (decide && event.type === "approval_request") {
        const answer = await post(`${base}/api/agent/runs/${runId}/approvals/${event.approvalId}`, decide(event));
        assert.equal(answer.status, 200);
      }
    }
  }
}

test("an approval travels from Claude Code through /mcp to the dashboard and back", async (context) => {
  const answers: unknown[] = [];
  const { app, base, tokens } = await startApp(async (mcp, emit) => {
    emit({ type: "system", subtype: "init", session_id: "6d1f0c8e-6b3b-4c55-9d43-1f4f3c2b9a10", tools: [] });
    answers.push(await mcp.approve("git_commit", { repository: "atlas-api", message: "Fix" }));
    answers.push(await mcp.approve("git_push", { repository: "atlas-api" }));
    answers.push(await mcp.approve("Bash", { command: "rm -rf /" }));
    emit({ type: "result", subtype: "success", result: "Committed, push declined.", session_id: "6d1f0c8e-6b3b-4c55-9d43-1f4f3c2b9a10" });
  });
  context.after(() => app.close());

  assert.deepEqual(await (await fetch(`${base}/api/agent`)).json(), { available: true, command: "claude", model: null });

  const started = await post(`${base}/api/agent/runs`, { prompt: "Commit and push atlas-api" });
  assert.equal(started.status, 202);
  const run = (await started.json()) as { id: string };

  const events = await follow(base, run.id, (event) =>
    event.type === "approval_request" && event.toolName === "git_commit" ? { behavior: "allow" } : { behavior: "deny", message: "after review" }
  );

  assert.deepEqual(answers, [
    { behavior: "allow", updatedInput: { repository: "atlas-api", message: "Fix" } },
    { behavior: "deny", message: "The user declined: after review" },
    { behavior: "deny", message: "mcp__repo-control__Bash is not a repo-control action this agent may run." }
  ]);
  assert.equal(events.filter((event) => event.type === "approval_request").length, 2, "a non-catalog tool is refused without asking the user");
  assert.equal(events.at(-1)?.type, "status");

  const finished = (await (await fetch(`${base}/api/agent/runs/${run.id}`)).json()) as { status: string; sessionId: string };
  assert.equal(finished.status, "completed");
  assert.equal(finished.sessionId, "6d1f0c8e-6b3b-4c55-9d43-1f4f3c2b9a10");

  const replay = await follow(base, run.id);
  assert.deepEqual(replay.map((event) => event.seq), events.map((event) => event.seq), "a finished run replays in full");

  const reused = await post(`${base}/mcp`, { jsonrpc: "2.0", id: 1, method: "tools/list" });
  assert.equal(reused.status, 404, "with no run alive and no external token the endpoint is off");
  const withOldToken = await fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", authorization: tokens[0] },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
  });
  assert.notEqual(withOldToken.status, 200, "a finished run's token is revoked");
});

test("agent routes validate input and report state conflicts", async (context) => {
  let release: () => void = () => {};
  const { app, base } = await startApp(() => new Promise<void>((resolve) => (release = resolve)));
  context.after(() => app.close());

  const blank = await post(`${base}/api/agent/runs`, { prompt: "   " });
  assert.equal(blank.status, 400);
  assert.match(((await blank.json()) as { message: string }).message, /^prompt: /);
  assert.equal((await fetch(`${base}/api/agent/runs/not-a-run`)).status, 400);
  assert.equal((await post(`${base}/api/agent/runs`, { prompt: "hi", sessionId: "not-a-uuid" })).status, 400);

  const run = (await (await post(`${base}/api/agent/runs`, { prompt: "hi" })).json()) as { id: string };
  const busy = await post(`${base}/api/agent/runs`, { prompt: "again" });
  assert.equal(busy.status, 409);
  assert.equal(((await busy.json()) as { code: string }).code, "AGENT_BUSY");

  const missing = "00000000-0000-4000-8000-000000000000";
  assert.equal((await fetch(`${base}/api/agent/runs/${missing}`)).status, 404);
  assert.equal((await fetch(`${base}/api/agent/runs/${missing}/events`)).status, 404);
  assert.equal((await post(`${base}/api/agent/runs/${run.id}/approvals/${missing}`, { behavior: "allow" })).status, 409);
  assert.equal((await post(`${base}/api/agent/runs/${run.id}/approvals/${missing}`, { behavior: "maybe" })).status, 400);

  assert.equal((await post(`${base}/api/agent/runs/${run.id}/cancel`, {})).status, 200);
  assert.equal((await post(`${base}/api/agent/runs/${run.id}/cancel`, {})).status, 409);
  release();
});

test("the agent model setting and the local MCP address are derived safely", async (context) => {
  assert.equal(readEnv({}).REPO_CONTROL_AGENT_MODEL, undefined);
  assert.equal(readEnv({ REPO_CONTROL_AGENT_MODEL: " haiku " }).REPO_CONTROL_AGENT_MODEL, "haiku");
  assert.equal(readEnv({ REPO_CONTROL_AGENT_MODEL: "claude-opus-5-5[1m]" }).REPO_CONTROL_AGENT_MODEL, "claude-opus-5-5[1m]");
  assert.throws(() => readEnv({ REPO_CONTROL_AGENT_MODEL: "sonnet --dangerously-skip-permissions" }), /model name or alias/);

  const app = Fastify();
  context.after(() => app.close());
  await app.listen({ host: "127.0.0.1", port: 0 });
  const port = (app.server.address() as { port: number }).port;
  assert.equal(getLocalMcpUrl(app, "0.0.0.0"), `http://127.0.0.1:${port}/mcp`);
  assert.equal(getLocalMcpUrl(app, "127.0.0.1"), `http://127.0.0.1:${port}/mcp`);
  assert.equal(getLocalMcpUrl(app, "::1"), `http://[::1]:${port}/mcp`);
});
