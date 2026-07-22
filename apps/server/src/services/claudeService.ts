import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runProjectCommand } from "../lib/commandRunner.js";
import type { CommandResult } from "../lib/commandRunner.js";

export type ClaudePermissionMode = "default" | "plan" | "acceptEdits" | "auto";

export type ClaudeSessionSource = "transcript" | "background";

export type ClaudeSessionSummary = {
  id: string;
  title: string;
  lastPrompt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  messageCount: number;
  turnCount: number;
  source: ClaudeSessionSource;
  status: string | null;
};

export type ClaudeTranscriptMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: string | null;
};

export type ClaudeSessionsResponse = {
  available: boolean;
  authenticated: boolean;
  version: string | null;
  sessions: ClaudeSessionSummary[];
  error: string | null;
};

export type ClaudeSessionDetails = {
  session: ClaudeSessionSummary | null;
  messages: ClaudeTranscriptMessage[];
};

export type ClaudeRunResponse = {
  ok: boolean;
  sessionId: string | null;
  response: string;
  error: string | null;
  commandResult: CommandResult;
};

const CLAUDE_COMMAND_TIMEOUT_MS = 1000 * 60 * 12;
const CLAUDE_STATUS_TIMEOUT_MS = 1000 * 20;
const MAX_CLAUDE_TRANSCRIPT_MESSAGES = 80;
const MAX_CLAUDE_MESSAGE_LENGTH = 4000;

export async function readClaudeSessions(projectPath: string): Promise<ClaudeSessionsResponse> {
  const [versionResult, authResult, transcriptSessions, backgroundSessions] = await Promise.all([
    runProjectCommand(projectPath, getClaudeCommand(), ["--version"], CLAUDE_STATUS_TIMEOUT_MS),
    runProjectCommand(projectPath, getClaudeCommand(), ["auth", "status", "--text"], CLAUDE_STATUS_TIMEOUT_MS),
    readClaudeTranscriptSessions(projectPath),
    readClaudeBackgroundSessions(projectPath)
  ]);

  const sessions = mergeClaudeSessions([...transcriptSessions, ...backgroundSessions]);

  return {
    available: versionResult.ok,
    authenticated: authResult.ok,
    version: versionResult.ok ? firstOutputLine(versionResult.stdout || versionResult.output) : null,
    sessions,
    error: versionResult.ok ? null : versionResult.output || "Claude Code non disponibile"
  };
}

export async function readClaudeSessionDetails(
  projectPath: string,
  sessionId: string
): Promise<ClaudeSessionDetails> {
  const transcriptFile = await getClaudeTranscriptFile(projectPath, sessionId);

  if (!transcriptFile) {
    return {
      session: null,
      messages: []
    };
  }

  const rows = await readClaudeTranscriptRows(transcriptFile);
  const stat = await fs.stat(transcriptFile).catch(() => null);

  return {
    session: buildClaudeTranscriptSummary(sessionId, rows, stat?.mtime.toISOString() ?? null),
    messages: getClaudeTranscriptMessages(rows)
  };
}

export async function runClaudeMessage(
  projectPath: string,
  prompt: string,
  sessionId: string | null | undefined,
  permissionMode: ClaudePermissionMode,
  additionalDirectories: string[] = [],
  signal?: AbortSignal
): Promise<ClaudeRunResponse> {
  const args = buildClaudeMessageArgs(prompt, sessionId, permissionMode, additionalDirectories);
  const displayCommand = [
    "claude",
    sessionId ? `--resume ${sessionId}` : "--new-session",
    "-p",
    "--output-format json",
    permissionMode === "default" ? "" : `--permission-mode ${permissionMode}`,
    additionalDirectories.length > 0 ? `--add-dir ${additionalDirectories.join(" ")}` : ""
  ]
    .filter(Boolean)
    .join(" ");
  const result = await runProjectCommand(projectPath, getClaudeCommand(), args, CLAUDE_COMMAND_TIMEOUT_MS, {
    displayCommand,
    signal
  });
  const parsedOutput = parseClaudeRunOutput(result.stdout);
  const nextSessionId = parsedOutput.sessionId ?? sessionId ?? null;
  const response = parsedOutput.response || result.stdout.trim() || result.stderr.trim();
  const ok = result.ok && !parsedOutput.isError;
  const commandResult: CommandResult = {
    ...result,
    ok,
    output: response || result.output,
    stderr: result.stderr || (ok ? "" : parsedOutput.error ?? "")
  };

  return {
    ok,
    sessionId: nextSessionId,
    response,
    error: ok ? null : ((parsedOutput.error ?? result.stderr) || result.output || "Claude Code command failed"),
    commandResult
  };
}

function buildClaudeMessageArgs(
  prompt: string,
  sessionId: string | null | undefined,
  permissionMode: ClaudePermissionMode,
  additionalDirectories: string[]
): string[] {
  const args: string[] = [];

  if (sessionId) {
    args.push("--resume", sessionId);
  }

  if (additionalDirectories.length > 0) {
    args.push("--add-dir", ...additionalDirectories);
  }

  args.push("--print", "--output-format", "json");

  if (permissionMode !== "default") {
    args.push("--permission-mode", permissionMode);
  }

  args.push(prompt);
  return args;
}

async function readClaudeTranscriptSessions(projectPath: string): Promise<ClaudeSessionSummary[]> {
  const transcriptDirectory = getClaudeProjectDirectory(projectPath);
  const files = await fs.readdir(transcriptDirectory).catch(() => []);
  const summaries = await Promise.all(
    files
      .filter((fileName) => fileName.endsWith(".jsonl"))
      .map(async (fileName) => {
        const sessionId = fileName.replace(/\.jsonl$/, "");
        const filePath = path.join(transcriptDirectory, fileName);
        const [rows, stat] = await Promise.all([
          readClaudeTranscriptRows(filePath),
          fs.stat(filePath).catch(() => null)
        ]);

        if (rows.length === 0 || !isClaudeSessionForProject(rows, projectPath)) {
          return null;
        }

        return buildClaudeTranscriptSummary(sessionId, rows, stat?.mtime.toISOString() ?? null);
      })
  );

  return summaries
    .filter((session): session is ClaudeSessionSummary => session !== null)
    .sort(sortClaudeSessions);
}

async function readClaudeBackgroundSessions(projectPath: string): Promise<ClaudeSessionSummary[]> {
  const result = await runProjectCommand(
    projectPath,
    getClaudeCommand(),
    ["agents", "--json", "--all", "--cwd", projectPath],
    CLAUDE_STATUS_TIMEOUT_MS
  );

  if (!result.ok) {
    return [];
  }

  return parseClaudeBackgroundSessions(result.stdout);
}

function parseClaudeBackgroundSessions(output: string): ClaudeSessionSummary[] {
  const parsed = parseJson(output);

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const id = firstString(item.id, item.sessionId, item.session_id);

      if (!id) {
        return null;
      }

      const title = firstString(item.name, item.title, item.task, item.prompt) ?? `Claude ${shortId(id)}`;
      const updatedAt = firstString(
        item.updatedAt,
        item.updated_at,
        item.lastActivityAt,
        item.createdAt,
        item.created_at
      );

      const session: ClaudeSessionSummary = {
        id,
        title: truncateText(compactText(title), 90),
        lastPrompt: firstString(item.prompt, item.task)
          ? truncateText(compactText(firstString(item.prompt, item.task) ?? ""), 180)
          : null,
        createdAt: firstString(item.createdAt, item.created_at) ?? null,
        updatedAt: updatedAt ?? null,
        messageCount: 0,
        turnCount: 0,
        source: "background" as const,
        status: firstString(item.status, item.state) ?? "background"
      };

      return session;
    })
    .filter((session): session is ClaudeSessionSummary => session !== null);
}

async function getClaudeTranscriptFile(projectPath: string, sessionId: string): Promise<string | null> {
  const transcriptFile = path.join(getClaudeProjectDirectory(projectPath), `${sessionId}.jsonl`);
  const stat = await fs.stat(transcriptFile).catch(() => null);

  return stat?.isFile() ? transcriptFile : null;
}

function getClaudeProjectDirectory(projectPath: string): string {
  const normalizedProjectPath = path.resolve(projectPath).replace(/\\/g, "/");
  const projectKey = normalizedProjectPath.replace(/[/:\\]/g, "-");

  return path.join(os.homedir(), ".claude", "projects", projectKey);
}

async function readClaudeTranscriptRows(filePath: string): Promise<Record<string, unknown>[]> {
  const content = await fs.readFile(filePath, "utf8").catch(() => "");

  return content
    .split("\n")
    .map((line) => parseJson(line))
    .filter(isRecord);
}

function buildClaudeTranscriptSummary(
  sessionId: string,
  rows: Record<string, unknown>[],
  fileUpdatedAt: string | null
): ClaudeSessionSummary {
  const messages = getClaudeTranscriptMessages(rows);
  const timestamps = messages
    .map((message) => message.timestamp)
    .filter((timestamp): timestamp is string => Boolean(timestamp));
  const title =
    rows.map(getClaudeTitle).find((value): value is string => Boolean(value)) ??
    getLastUserPrompt(messages) ??
    `Claude ${shortId(sessionId)}`;

  return {
    id: sessionId,
    title: truncateText(compactText(title), 90),
    lastPrompt: getLastUserPrompt(messages),
    createdAt: timestamps[0] ?? null,
    updatedAt: timestamps[timestamps.length - 1] ?? fileUpdatedAt,
    messageCount: messages.length,
    turnCount: messages.filter((message) => message.role === "user").length,
    source: "transcript",
    status: null
  };
}

function getClaudeTranscriptMessages(rows: Record<string, unknown>[]): ClaudeTranscriptMessage[] {
  return rows
    .map((row) => {
      const type = firstString(row.type);
      const timestamp = firstString(row.timestamp) ?? null;

      if (type === "user" || type === "assistant") {
        const text = extractClaudeMessageText(row.message);

        if (!text) {
          return null;
        }

        return {
          id: firstString(row.uuid, row.requestId) ?? `${type}-${timestamp ?? Math.random().toString(36).slice(2)}`,
          role: type,
          text: truncateText(text, MAX_CLAUDE_MESSAGE_LENGTH),
          timestamp
        };
      }

      if (type === "system") {
        const text = extractClaudeMessageText(row.message) || firstString(row.content) || "";

        if (!text) {
          return null;
        }

        return {
          id: firstString(row.uuid) ?? `system-${timestamp ?? Math.random().toString(36).slice(2)}`,
          role: "system" as const,
          text: truncateText(text, MAX_CLAUDE_MESSAGE_LENGTH),
          timestamp
        };
      }

      return null;
    })
    .filter((message): message is ClaudeTranscriptMessage => message !== null)
    .slice(-MAX_CLAUDE_TRANSCRIPT_MESSAGES);
}

function isClaudeSessionForProject(rows: Record<string, unknown>[], projectPath: string): boolean {
  const normalizedProjectPath = path.resolve(projectPath);

  return rows.some((row) => {
    const cwd = firstString(row.cwd);

    if (!cwd) {
      return false;
    }

    return path.resolve(cwd) === normalizedProjectPath;
  });
}

function mergeClaudeSessions(sessions: ClaudeSessionSummary[]): ClaudeSessionSummary[] {
  const sessionsById = new Map<string, ClaudeSessionSummary>();

  for (const session of sessions) {
    const existingSession = sessionsById.get(session.id);

    if (!existingSession || session.source === "transcript") {
      sessionsById.set(session.id, {
        ...existingSession,
        ...session,
        status: session.status ?? existingSession?.status ?? null
      });
    }
  }

  return [...sessionsById.values()].sort(sortClaudeSessions);
}

function sortClaudeSessions(left: ClaudeSessionSummary, right: ClaudeSessionSummary): number {
  return Date.parse(right.updatedAt ?? right.createdAt ?? "") - Date.parse(left.updatedAt ?? left.createdAt ?? "");
}

function getClaudeTitle(row: Record<string, unknown>): string | null {
  if (row.type !== "ai-title") {
    return null;
  }

  return firstString(row.title, row.summary, row.message, row.text);
}

function getLastUserPrompt(messages: ClaudeTranscriptMessage[]): string | null {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");

  return lastUserMessage ? truncateText(compactText(lastUserMessage.text), 180) : null;
}

function parseClaudeRunOutput(output: string): {
  sessionId: string | null;
  response: string;
  error: string | null;
  isError: boolean;
} {
  const parsed = parseJson(output.trim());

  if (!isRecord(parsed)) {
    return {
      sessionId: null,
      response: output.trim(),
      error: null,
      isError: false
    };
  }

  const sessionId = firstString(parsed.session_id, parsed.sessionId);
  const response = firstString(parsed.result, parsed.response, parsed.text, parsed.message) ?? "";
  const error = firstString(parsed.error, parsed.message_error, parsed.stderr);
  const isError = parsed.is_error === true || parsed.type === "error" || Boolean(error);

  return {
    sessionId,
    response,
    error: error ?? null,
    isError
  };
}

function extractClaudeMessageText(message: unknown): string {
  if (typeof message === "string") {
    return normalizeText(message);
  }

  if (Array.isArray(message)) {
    return normalizeText(message.map(extractClaudeMessageText).filter(Boolean).join("\n"));
  }

  if (!isRecord(message)) {
    return "";
  }

  if (typeof message.content !== "undefined") {
    return extractClaudeMessageText(message.content);
  }

  if (typeof message.text === "string") {
    return normalizeText(message.text);
  }

  const type = firstString(message.type);
  const name = firstString(message.name);

  if (type === "tool_use" && name) {
    return `[tool: ${name}]`;
  }

  if (type === "tool_result") {
    return `[tool result] ${extractClaudeMessageText(message.content)}`;
  }

  return "";
}

function getClaudeCommand(): string {
  return process.env.REPO_CONTROL_CLAUDE?.trim() || "claude";
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function firstOutputLine(value: string): string {
  return value.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
}

function normalizeText(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function compactText(value: string): string {
  return normalizeText(value).replace(/\s+/g, " ");
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function shortId(value: string): string {
  return value.length > 8 ? value.slice(0, 8) : value;
}
