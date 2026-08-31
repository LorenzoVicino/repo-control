import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  findAgentSession,
  getAgentResumeSpec,
  scanAgentSessions
} from "./agentSessionService.js";

test("discovers Codex, Claude Code and Gemini sessions for workspace projects", async (context) => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-agent-sessions-"));
  const homeDirectory = path.join(temporaryDirectory, "home");
  const executableDirectory = path.join(temporaryDirectory, "bin");
  const projectPath = path.join(temporaryDirectory, "workspace", "product");
  const project = {
    id: "product-id",
    name: "product",
    path: projectPath
  };
  const codexId = "11111111-1111-4111-8111-111111111111";
  const claudeId = "22222222-2222-4222-8222-222222222222";
  const geminiId = "33333333-3333-4333-8333-333333333333";
  const codexFile = path.join(homeDirectory, ".codex", "sessions", "2026", "07", "30", `${codexId}.jsonl`);
  const claudeFile = path.join(
    homeDirectory,
    ".claude",
    "projects",
    "-temporary-workspace-product",
    `${claudeId}.jsonl`
  );
  const claudeSubagentFile = path.join(
    path.dirname(claudeFile),
    claudeId,
    "subagents",
    "agent-helper.jsonl"
  );
  const geminiKey = createHash("sha256").update(projectPath).digest("hex");
  const geminiDirectory = path.join(homeDirectory, ".gemini", "tmp", geminiKey);
  const geminiFile = path.join(geminiDirectory, "chats", "session.jsonl");

  context.after(() => fs.rm(temporaryDirectory, { recursive: true, force: true }));

  await Promise.all([
    fs.mkdir(path.dirname(codexFile), { recursive: true }),
    fs.mkdir(path.dirname(claudeFile), { recursive: true }),
    fs.mkdir(path.dirname(claudeSubagentFile), { recursive: true }),
    fs.mkdir(path.dirname(geminiFile), { recursive: true }),
    fs.mkdir(executableDirectory, { recursive: true }),
    fs.mkdir(projectPath, { recursive: true })
  ]);
  await Promise.all(
    ["codex", "claude", "gemini"].map(async (command) => {
      const executablePath = path.join(executableDirectory, process.platform === "win32" ? `${command}.cmd` : command);
      await fs.writeFile(executablePath, process.platform === "win32" ? "@echo off\r\n" : "#!/bin/sh\n");
      await fs.chmod(executablePath, 0o755);
    })
  );
  await fs.writeFile(
    codexFile,
    [
      JSON.stringify({
        type: "session_meta",
        payload: {
          id: codexId,
          cwd: projectPath,
          timestamp: "2026-07-30T08:00:00.000Z",
          git: { branch: "main" }
        }
      }),
      JSON.stringify({
        type: "response_item",
        payload: {
          role: "user",
          content: [{ type: "input_text", text: "Implement the analytics dashboard" }]
        }
      }),
      JSON.stringify({
        type: "response_item",
        payload: {
          role: "tool",
          content: "x".repeat(1024 * 1024)
        }
      }),
      JSON.stringify({
        type: "response_item",
        payload: {
          role: "assistant",
          content: [{ type: "output_text", text: "I configured the retry budget for the calls." }]
        }
      })
    ].join("\n")
  );
  await fs.writeFile(
    claudeFile,
    [
      JSON.stringify({
        type: "user",
        cwd: projectPath,
        gitBranch: "feature/checkout",
        sessionId: claudeId,
        timestamp: "2026-07-29T07:59:00.000Z",
        message: { content: "<local-command-caveat>Internal technical message</local-command-caveat>" }
      }),
      JSON.stringify({
        type: "user",
        cwd: projectPath,
        gitBranch: "feature/checkout",
        sessionId: claudeId,
        timestamp: "2026-07-29T08:00:00.000Z",
        message: { content: "Improve the checkout" }
      }),
      JSON.stringify({
        type: "ai-title",
        sessionId: claudeId,
        timestamp: "2026-07-29T08:01:00.000Z",
        aiTitle: "More reliable checkout"
      }),
      JSON.stringify({
        type: "custom-title",
        sessionId: claudeId,
        timestamp: "2026-07-29T08:02:00.000Z",
        customTitle: "Frictionless checkout"
      })
    ].join("\n")
  );
  await fs.writeFile(
    claudeSubagentFile,
    JSON.stringify({
      type: "user",
      cwd: projectPath,
      sessionId: claudeId,
      timestamp: "2026-07-30T11:00:00.000Z",
      message: { content: "Internal sub-agent prompt" }
    })
  );
  await fs.writeFile(path.join(geminiDirectory, ".project_root"), projectPath);
  await fs.writeFile(
    geminiFile,
    [
      JSON.stringify({
        kind: "session",
        sessionId: geminiId,
        startTime: "2026-07-28T08:00:00.000Z",
        lastUpdated: "2026-07-28T09:00:00.000Z"
      }),
      JSON.stringify({
        type: "user",
        content: "Add the end-to-end tests",
        timestamp: "2026-07-28T08:00:01.000Z"
      })
    ].join("\n")
  );
  await fs.utimes(codexFile, new Date("2026-07-30T10:00:00.000Z"), new Date("2026-07-30T10:00:00.000Z"));
  await fs.utimes(claudeFile, new Date("2026-07-29T10:00:00.000Z"), new Date("2026-07-29T10:00:00.000Z"));

  const result = await scanAgentSessions(temporaryDirectory, [project], {
    homeDirectory,
    env: { PATH: executableDirectory },
    codexThreadTitles: new Map([[codexId, "Dashboard analytics"]])
  });

  assert.equal(result.sessions.length, 3);
  assert.deepEqual(result.sessions.map((session) => session.provider), ["codex", "claude", "gemini"]);
  assert.deepEqual(
    result.sessions.map((session) => session.updatedAt),
    [
      "2026-07-30T10:00:00.000Z",
      "2026-07-29T10:00:00.000Z",
      "2026-07-28T09:00:00.000Z"
    ]
  );
  assert.deepEqual(result.agents.map((agent) => ({
    id: agent.id,
    installed: agent.installed,
    used: agent.used,
    sessionCount: agent.sessionCount
  })), [
    { id: "claude", installed: true, used: true, sessionCount: 1 },
    { id: "codex", installed: true, used: true, sessionCount: 1 },
    { id: "gemini", installed: true, used: true, sessionCount: 1 }
  ]);
  assert.equal(result.sessions.find((session) => session.provider === "claude")?.title, "Frictionless checkout");
  assert.equal(result.sessions.find((session) => session.provider === "claude")?.preview, "Improve the checkout");
  assert.equal(result.sessions.find((session) => session.provider === "codex")?.title, "Dashboard analytics");
  assert.equal(
    result.sessions.find((session) => session.provider === "codex")?.preview,
    "Implement the analytics dashboard"
  );
  assert.equal(result.sessions.find((session) => session.provider === "codex")?.branch, "main");
  assert.equal(result.sessions.find((session) => session.provider === "gemini")?.projectId, project.id);
  assert.equal(findAgentSession(result, "codex", codexId, project.id)?.title, "Dashboard analytics");

  const searchResult = await scanAgentSessions(temporaryDirectory, [project], {
    homeDirectory,
    env: { PATH: executableDirectory },
    codexThreadTitles: new Map([[codexId, "Dashboard analytics"]]),
    searchTerm: "retry budget"
  });

  assert.equal(searchResult.sessions.length, 1);
  assert.equal(searchResult.sessions[0]?.provider, "codex");
  assert.equal(searchResult.sessions[0]?.match?.field, "content");
  assert.match(searchResult.sessions[0]?.match?.snippet ?? "", /retry budget/);
  assert.deepEqual(
    searchResult.agents.map((agent) => agent.sessionCount),
    [1, 1, 1],
    "provider cards keep total counts while results are filtered"
  );
});

test("builds provider-specific resume commands without accepting arbitrary commands", () => {
  assert.deepEqual(getAgentResumeSpec("codex", "session-1", {}), {
    command: "codex",
    args: ["resume", "session-1"],
    displayCommand: "codex resume session-1"
  });
  assert.deepEqual(getAgentResumeSpec("claude", "session-2", {}), {
    command: "claude",
    args: ["--resume", "session-2"],
    displayCommand: "claude --resume session-2"
  });
  assert.deepEqual(getAgentResumeSpec("gemini", "session-3", {}), {
    command: "gemini",
    args: ["--resume", "session-3"],
    displayCommand: "gemini --resume session-3"
  });
});
