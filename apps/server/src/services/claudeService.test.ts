import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  readClaudeSessionDetails,
  readClaudeSessions,
  runClaudeMessage
} from "./claudeService.js";

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function transcriptDirectory(homePath: string, projectPath: string): string {
  const key = path.resolve(projectPath).replace(/\\/g, "/").replace(/[/:\\]/g, "-");
  return path.join(homePath, ".claude", "projects", key);
}

async function createFakeClaudeCli(temporaryRoot: string): Promise<string> {
  const scriptPath = path.join(temporaryRoot, "fake-claude.cjs");
  const commandPath = path.join(temporaryRoot, process.platform === "win32" ? "fake-claude.cmd" : "fake-claude");
  const backgroundSessions = [
    { session_id: "shared-session", name: "Background duplicate", prompt: "background prompt", created_at: "2026-08-01T00:00:00.000Z", status: "running" },
    { sessionId: "background-2", title: "Background two", task: "Do work", updated_at: "2026-08-04T00:00:00.000Z", state: "done" },
    { id: "short", createdAt: "2026-08-02T00:00:00.000Z" },
    { id: "123456789", lastActivityAt: "2026-08-03T00:00:00.000Z" },
    null,
    "bad",
    { title: "missing id" }
  ];

  await fs.writeFile(scriptPath, `const fs = require("node:fs");
const args = process.argv.slice(2);
const mode = process.env.REPO_CONTROL_CLAUDE_TEST_MODE;

if (args.includes("--version")) {
  if (mode === "status-fail") {
    process.stderr.write("missing cli\\n");
    process.exitCode = 1;
  } else {
    process.stdout.write("  claude 9.1.0  \\nsecond line\\n");
  }
} else if (args[0] === "auth") {
  if (mode === "status-fail") {
    process.stderr.write("not authenticated\\n");
    process.exitCode = 1;
  } else {
    process.stdout.write("authenticated\\n");
  }
} else if (args[0] === "agents") {
  if (mode === "background-fail" || mode === "status-fail") {
    process.stderr.write("unsupported\\n");
    process.exitCode = 1;
  } else {
    process.stdout.write(${JSON.stringify(JSON.stringify(backgroundSessions) + "\n")});
  }
} else {
  if (process.env.REPO_CONTROL_CLAUDE_ARGS_PATH) {
    fs.writeFileSync(process.env.REPO_CONTROL_CLAUDE_ARGS_PATH, args.join("\\n") + "\\n");
  }

  switch (mode) {
    case "json-success": process.stdout.write('{"session_id":"new-session","result":"Implemented"}\\n'); break;
    case "json-error": process.stdout.write('{"sessionId":"error-session","response":"Partial","error":"permission denied","is_error":true}\\n'); break;
    case "typed-error": process.stdout.write('{"type":"error","message_error":"typed failure","stderr":"stderr fallback"}\\n'); break;
    case "plain": process.stdout.write(" plain response \\n"); break;
    case "stderr": process.stderr.write("cli exploded\\n"); process.exitCode = 1; break;
    case "empty": process.exitCode = 1; break;
    default: process.stderr.write("unexpected arguments: " + args.join(" ") + "\\n"); process.exitCode = 2;
  }
}
`, "utf8");

  if (process.platform === "win32") {
    await fs.writeFile(commandPath, `@echo off\r\n"${process.execPath}" "${scriptPath}" %*\r\n`, "utf8");
  } else {
    await fs.writeFile(commandPath, `#!/usr/bin/env sh\nexec "${process.execPath}" "${scriptPath}" "$@"\n`, "utf8");
    await fs.chmod(commandPath, 0o755);
  }

  return commandPath;
}

test("discovers Claude transcript and background sessions and reconstructs message details", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-claude-sessions-"));
  const projectPath = path.join(temporaryRoot, "project");
  const homePath = path.join(temporaryRoot, "home");
  const cliPath = await createFakeClaudeCli(temporaryRoot);
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  const previousClaude = process.env.REPO_CONTROL_CLAUDE;
  const previousMode = process.env.REPO_CONTROL_CLAUDE_TEST_MODE;

  try {
    process.env.HOME = homePath;
    process.env.USERPROFILE = homePath;
    process.env.REPO_CONTROL_CLAUDE = cliPath;
    process.env.REPO_CONTROL_CLAUDE_TEST_MODE = "sessions";
    await fs.mkdir(projectPath, { recursive: true });
    const directory = transcriptDirectory(homePath, projectPath);
    await fs.mkdir(directory, { recursive: true });
    const longTitle = `A title ${"x".repeat(120)}`;
    const longMessage = "m".repeat(4100);
    const rows = [
      { type: "ai-title", title: longTitle },
      { type: "user", uuid: "u1", cwd: projectPath, timestamp: "2026-08-01T10:00:00.000Z", message: " First   prompt " },
      { type: "assistant", requestId: "a1", cwd: projectPath, timestamp: "2026-08-01T10:01:00.000Z", message: { content: [
        { type: "text", text: "Answer" },
        { type: "tool_use", name: "Read" },
        { type: "tool_result", content: { text: "tool output" } }
      ] } },
      { type: "system", uuid: "s1", cwd: projectPath, timestamp: "2026-08-01T10:02:00.000Z", content: "System note" },
      { type: "assistant", cwd: projectPath, message: { text: longMessage } },
      { type: "assistant", cwd: projectPath, message: 42 },
      { type: "system", cwd: projectPath },
      { type: "progress", cwd: projectPath, message: "ignored" }
    ];
    await fs.writeFile(path.join(directory, "shared-session.jsonl"), `${rows.map((row) => JSON.stringify(row)).join("\n")}\ninvalid-json\n`, "utf8");
    await fs.writeFile(path.join(directory, "wrong-project.jsonl"), `${JSON.stringify({ type: "user", cwd: "/other", message: "Wrong" })}\n`, "utf8");
    await fs.writeFile(path.join(directory, "empty.jsonl"), "invalid\n", "utf8");
    await fs.writeFile(path.join(directory, "ignore.txt"), "ignored", "utf8");

    const response = await readClaudeSessions(projectPath);
    assert.equal(response.available, true);
    assert.equal(response.authenticated, true);
    assert.equal(response.version, "claude 9.1.0", JSON.stringify(response));
    assert.equal(response.error, null);
    assert.deepEqual(response.sessions.map((session) => session.id), ["background-2", "123456789", "short", "shared-session"]);
    const transcript = response.sessions.find((session) => session.id === "shared-session")!;
    assert.equal(transcript.source, "transcript");
    assert.equal(transcript.title.endsWith("..."), true);
    assert.equal(transcript.turnCount, 1);
    assert.equal(transcript.messageCount, 4);

    const details = await readClaudeSessionDetails(projectPath, "shared-session");
    assert.equal(details.session?.id, "shared-session");
    assert.equal(details.messages.length, 4);
    assert.equal(details.messages[0]?.text, "First   prompt");
    assert.match(details.messages[1]?.text ?? "", /\[tool: Read\]/);
    assert.match(details.messages[1]?.text ?? "", /\[tool result\] tool output/);
    assert.equal(details.messages[3]?.text.length, 4000);
    assert.deepEqual(await readClaudeSessionDetails(projectPath, "missing"), { session: null, messages: [] });

    process.env.REPO_CONTROL_CLAUDE_TEST_MODE = "status-fail";
    const unavailable = await readClaudeSessions(projectPath);
    assert.equal(unavailable.available, false);
    assert.equal(unavailable.authenticated, false);
    assert.equal(unavailable.version, null);
    assert.match(unavailable.error ?? "", /missing cli/);
    assert.ok(unavailable.sessions.some((session) => session.id === "shared-session"));
  } finally {
    restoreEnv("HOME", previousHome);
    restoreEnv("USERPROFILE", previousUserProfile);
    restoreEnv("REPO_CONTROL_CLAUDE", previousClaude);
    restoreEnv("REPO_CONTROL_CLAUDE_TEST_MODE", previousMode);
    await fs.rm(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("runs new and resumed Claude messages and normalizes JSON, plain and failed responses", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-claude-run-"));
  const projectPath = path.join(temporaryRoot, "project");
  const cliPath = await createFakeClaudeCli(temporaryRoot);
  const argsPath = path.join(temporaryRoot, "args.txt");
  const previousClaude = process.env.REPO_CONTROL_CLAUDE;
  const previousMode = process.env.REPO_CONTROL_CLAUDE_TEST_MODE;
  const previousArgsPath = process.env.REPO_CONTROL_CLAUDE_ARGS_PATH;

  try {
    await fs.mkdir(projectPath);
    process.env.REPO_CONTROL_CLAUDE = `  ${cliPath}  `;
    process.env.REPO_CONTROL_CLAUDE_ARGS_PATH = argsPath;
    process.env.REPO_CONTROL_CLAUDE_TEST_MODE = "json-success";
    const created = await runClaudeMessage(projectPath, "Implement", null, "plan", ["/context/one", "/context/two"]);
    assert.equal(created.ok, true);
    assert.equal(created.sessionId, "new-session", JSON.stringify(created));
    assert.equal(created.response, "Implemented");
    assert.equal(created.error, null);
    let args = (await fs.readFile(argsPath, "utf8")).trim().split("\n");
    assert.deepEqual(args.slice(0, 4), ["--add-dir", "/context/one", "/context/two", "--print"]);
    assert.ok(args.includes("--permission-mode"));

    process.env.REPO_CONTROL_CLAUDE_TEST_MODE = "json-error";
    const resumed = await runClaudeMessage(projectPath, "Continue", "existing-session", "default");
    assert.equal(resumed.ok, false);
    assert.equal(resumed.sessionId, "error-session");
    assert.equal(resumed.response, "Partial");
    assert.equal(resumed.error, "permission denied");
    assert.equal(resumed.commandResult.stderr, "permission denied");
    args = (await fs.readFile(argsPath, "utf8")).trim().split("\n");
    assert.deepEqual(args.slice(0, 2), ["--resume", "existing-session"]);
    assert.equal(args.includes("--permission-mode"), false);

    process.env.REPO_CONTROL_CLAUDE_TEST_MODE = "typed-error";
    const typedError = await runClaudeMessage(projectPath, "Try", undefined, "auto");
    assert.equal(typedError.ok, false);
    assert.equal(typedError.error, "typed failure");

    process.env.REPO_CONTROL_CLAUDE_TEST_MODE = "plain";
    const plain = await runClaudeMessage(projectPath, "Explain", undefined, "acceptEdits");
    assert.equal(plain.ok, true);
    assert.equal(plain.sessionId, null);
    assert.equal(plain.response, "plain response");

    process.env.REPO_CONTROL_CLAUDE_TEST_MODE = "stderr";
    const stderr = await runClaudeMessage(projectPath, "Fail", "fallback-session", "plan");
    assert.equal(stderr.ok, false);
    assert.equal(stderr.sessionId, "fallback-session");
    assert.equal(stderr.response, "cli exploded");
    assert.equal(stderr.error, "cli exploded");

    process.env.REPO_CONTROL_CLAUDE_TEST_MODE = "empty";
    const empty = await runClaudeMessage(projectPath, "Empty", null, "plan");
    assert.equal(empty.ok, false);
    assert.equal(empty.error, "Claude Code command failed");
  } finally {
    restoreEnv("REPO_CONTROL_CLAUDE", previousClaude);
    restoreEnv("REPO_CONTROL_CLAUDE_TEST_MODE", previousMode);
    restoreEnv("REPO_CONTROL_CLAUDE_ARGS_PATH", previousArgsPath);
    await fs.rm(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
