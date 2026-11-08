import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { promises as fs } from "node:fs";
import { PassThrough } from "node:stream";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { ApprovalDecision, McpAccessControl, RequestApproval } from "../mcp/access.js";
import { TOOL_CATALOG } from "../tools/index.js";
import type { AgentEvent } from "./events.js";
import { AgentBusyError, createAgentRunner, type AgentRunnerOptions } from "./runner.js";

type FakeChild = ChildProcess & {
  stdinText: Promise<string>;
  emitLine: (value: unknown) => void;
  finish: (code: number, stderr?: string) => void;
};

function fakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdin = new PassThrough();
  let text = "";
  stdin.on("data", (chunk) => (text += chunk));
  child.stdinText = new Promise((resolve) => stdin.on("finish", () => resolve(text)));
  Object.assign(child, { stdout, stderr, stdin });
  child.emitLine = (value) => stdout.write(`${JSON.stringify(value)}\n`);
  child.finish = (code, message) => {
    if (message) stderr.write(message);
    stdout.end();
    // readline delivers the last lines asynchronously; close after that, as a real process does.
    setImmediate(() => child.emit("close", code));
  };
  return child;
}

function setup(overrides: Partial<AgentRunnerOptions> = {}) {
  const spawned: Array<{ command: string; args: string[]; child: FakeChild; cwd: unknown; env: NodeJS.ProcessEnv | undefined }> = [];
  const grants: Array<{ requestApproval: RequestApproval; revoked: boolean }> = [];
  const mcpAccess: McpAccessControl = {
    enabled: () => true,
    authorize: () => null,
    issueAgentToken(requestApproval) {
      const grant = { requestApproval, revoked: false };
      grants.push(grant);
      return { token: `token-${grants.length}`, revoke: () => (grant.revoked = true) };
    }
  };
  const runner = createAgentRunner({
    claudeCommand: "claude",
    model: "sonnet",
    mcpUrl: () => "http://127.0.0.1:3747/mcp",
    mcpAccess,
    workspaceRoot: () => "/workspace/projects",
    tools: TOOL_CATALOG,
    spawnProcess: (command, args, options) => {
      const child = fakeChild();
      spawned.push({ command, args, child, cwd: options.cwd, env: options.env });
      return child;
    },
    killProcess: (child) => (child as FakeChild).finish(143),
    ...overrides
  });
  return { runner, spawned, grants };
}

function collect(runner: ReturnType<typeof setup>["runner"], runId: string) {
  const events: AgentEvent[] = [];
  const ended = new Promise<void>((resolve) => runner.subscribe(runId, -1, (event) => events.push(event), resolve));
  return { events, ended };
}

const argValue = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

test("a run starts Claude Code locked down to repo-control's tools and streams its output", async () => {
  const { runner, spawned, grants } = setup();
  const run = await runner.start({ prompt: "--help; what needs attention?" });
  const { events, ended } = collect(runner, run.id);
  const [{ command, args, child, cwd, env }] = spawned;

  assert.equal(command, "claude");
  assert.equal(cwd, "/workspace/projects");
  assert.equal(argValue(args, "--tools"), "", "built-in tools such as Bash and Edit are off");
  assert.equal(argValue(args, "--setting-sources"), "", "user settings cannot pre-approve anything");
  assert.equal(argValue(args, "--permission-prompt-tool"), "mcp__repo-control__approve");
  assert.equal(argValue(args, "--model"), "sonnet");
  assert.ok(args.includes("--strict-mcp-config"));
  assert.ok(!args.includes("--resume"));
  const allowed = argValue(args, "--allowedTools").split(",");
  assert.ok(allowed.includes("mcp__repo-control__list_repositories"));
  assert.ok(!allowed.some((name) => /git_push|git_commit|run_workflow/.test(name)), "write tools are never pre-allowed");
  assert.ok(!args.some((arg) => arg.includes("token-1")), "the MCP token never appears on the command line");
  assert.ok(Number(env?.MCP_TOOL_TIMEOUT) > 10 * 60_000, "an approval may wait longer than the default MCP timeout");

  const config = JSON.parse(await fs.readFile(argValue(args, "--mcp-config"), "utf8"));
  assert.deepEqual(config.mcpServers["repo-control"], { type: "http", url: "http://127.0.0.1:3747/mcp", headers: { Authorization: "Bearer token-1" } });
  if (process.platform !== "win32") assert.equal((await fs.stat(argValue(args, "--mcp-config"))).mode & 0o777, 0o600);
  assert.match(await fs.readFile(argValue(args, "--append-system-prompt-file"), "utf8"), /workspace folder "projects"/);
  assert.equal(await child.stdinText, "--help; what needs attention?", "the prompt arrives on stdin, never as an option");

  child.emitLine({ type: "system", subtype: "init", session_id: "s-1", model: "claude-sonnet-5-5", tools: [] });
  child.emitLine({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "All " } } });
  child.emitLine({ type: "result", subtype: "success", result: "All clean.", session_id: "s-1", total_cost_usd: 0.002, duration_ms: 800, num_turns: 1 });
  child.finish(0);
  await ended;

  assert.deepEqual(
    events.map((event) => event.type),
    ["status", "session", "text_delta", "result", "status"]
  );
  assert.deepEqual(events.map((event) => event.seq), [0, 1, 2, 3, 4]);
  const finished = runner.get(run.id);
  assert.equal(finished?.status, "completed");
  assert.equal(finished?.sessionId, "s-1");
  assert.equal(grants[0].revoked, true, "the run's MCP token dies with the run");
  const configPath = argValue(args, "--mcp-config");
  for (let attempt = 0; attempt < 50 && (await fs.access(configPath).then(() => true, () => false)); attempt += 1) await delay(10);
  await assert.rejects(fs.access(configPath), "the config file holding the token is deleted");

  await runner.start({ prompt: "and now?", resumeSessionId: "s-1" });
  assert.equal(argValue(spawned[1].args, "--resume"), "s-1", "a follow-up continues the same Claude Code session");
});

test("write tools wait for the user's decision, which goes back to Claude Code", async () => {
  const { runner, spawned, grants } = setup({ approvalTimeoutMs: 50 });
  const run = await runner.start({ prompt: "commit it" });
  const { events, ended } = collect(runner, run.id);
  const requestApproval = grants[0].requestApproval;

  const allowed = requestApproval({ toolName: "git_commit", input: { repository: "atlas-api", message: "Fix" } });
  const request = events.find((event) => event.type === "approval_request");
  assert.ok(request && request.type === "approval_request");
  assert.equal(request.title, "Commit");
  assert.deepEqual(request.input, { repository: "atlas-api", message: "Fix" });
  assert.equal(runner.decide(run.id, request.approvalId, { behavior: "allow" }), true);
  assert.deepEqual(await allowed, { behavior: "allow" });
  assert.equal(runner.decide(run.id, request.approvalId, { behavior: "allow" }), false, "an approval is answered once");

  const denied = requestApproval({ toolName: "git_push", input: { repository: "atlas-api" } });
  const second = events.filter((event) => event.type === "approval_request")[1];
  assert.ok(second?.type === "approval_request");
  runner.decide(run.id, second.approvalId, { behavior: "deny", message: "  not before review " });
  assert.deepEqual(await denied, { behavior: "deny", message: "The user declined: not before review" });

  const expired: ApprovalDecision = await requestApproval({ toolName: "git_pull", input: { repository: "atlas-api" } });
  assert.equal(expired.behavior, "deny");
  assert.deepEqual(
    events.filter((event) => event.type === "approval_resolved").map((event) => (event.type === "approval_resolved" ? [event.behavior, event.reason] : [])),
    [["allow", "user"], ["deny", "user"], ["deny", "timeout"]]
  );

  const pending = requestApproval({ toolName: "git_push", input: { repository: "atlas-api" } });
  assert.equal(runner.cancel(run.id), true);
  assert.deepEqual(await pending, { behavior: "deny", message: "The run was stopped." }, "stopping a run refuses what it was waiting for");
  await ended;
  assert.equal(runner.get(run.id)?.status, "cancelled");
  assert.equal(runner.cancel(run.id), false);
  assert.deepEqual(await requestApproval({ toolName: "git_push", input: {} }), { behavior: "deny", message: "The run has ended." });
  assert.equal(spawned.length, 1);
});

test("failures are reported in words and the runner refuses to overlap runs", async () => {
  const { runner, spawned } = setup();

  const crashed = await runner.start({ prompt: "hi" });
  await assert.rejects(runner.start({ prompt: "again" }), AgentBusyError);
  const crash = collect(runner, crashed.id);
  spawned[0].child.finish(1, "Error: Invalid API key · Please run /login\n");
  await crash.ended;
  assert.equal(runner.get(crashed.id)?.status, "failed");
  assert.deepEqual(crash.events.at(-2), { ...crash.events.at(-2), type: "error", message: "Error: Invalid API key · Please run /login" });

  const missing = await runner.start({ prompt: "hi" });
  const notFound = collect(runner, missing.id);
  spawned[1].child.emit("error", Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" }));
  await notFound.ended;
  assert.match(JSON.stringify(notFound.events), /Claude Code was not found \(\\"claude\\"\)\. Install it, or set REPO_CONTROL_CLAUDE/);

  const errored = await runner.start({ prompt: "hi" });
  const result = collect(runner, errored.id);
  spawned[2].child.emitLine({ type: "result", subtype: "error_during_execution", is_error: true, errors: ["MCP server failed"] });
  spawned[2].child.finish(1);
  await result.ended;
  assert.equal(runner.get(errored.id)?.status, "failed");
  assert.equal(result.events.filter((event) => event.type === "error").length, 0, "a reported result is not repeated as a generic error");

  assert.equal(runner.get("unknown"), null);
  assert.equal(runner.subscribe("unknown", -1, () => {}, () => {}), null);
  assert.equal(runner.decide("unknown", "a", { behavior: "allow" }), false);
});

test("a late subscriber gets the history it missed, and stopAll ends live runs", async () => {
  const { runner, spawned } = setup({ maxActiveRuns: 2 });
  const first = await runner.start({ prompt: "one" });
  spawned[0].child.emitLine({ type: "assistant", message: { content: [{ type: "text", text: "Looking." }] } });
  await delay(10);

  const replayed: AgentEvent[] = [];
  runner.subscribe(first.id, 0, (event) => replayed.push(event), () => {});
  assert.deepEqual(replayed.map((event) => event.type), ["text"], "events after seq 0 are replayed");

  await runner.start({ prompt: "two" });
  runner.stopAll();
  assert.equal(runner.get(first.id)?.status, "cancelled");
});
