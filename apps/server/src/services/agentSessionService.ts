import { createHash } from "node:crypto";
import { constants as fsConstants, createReadStream, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import type { ProjectSummary } from "../gitScanner.js";

export type AgentSessionProvider = "claude" | "codex" | "gemini";

export type AgentInstallation = {
  id: AgentSessionProvider;
  label: string;
  installed: boolean;
  used: boolean;
  command: string;
  sessionCount: number;
};

export type AgentSessionSummary = {
  id: string;
  provider: AgentSessionProvider;
  providerLabel: string;
  projectId: string;
  projectName: string;
  projectPath: string;
  title: string;
  preview: string | null;
  branch: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  match: AgentSessionSearchMatch | null;
};

export type AgentSessionSearchMatch = {
  field: "title" | "content";
  snippet: string;
};

export type AgentSessionsResponse = {
  root: string;
  agents: AgentInstallation[];
  sessions: AgentSessionSummary[];
  scannedAt: string;
  warnings: string[];
};

export type AgentResumeSpec = {
  command: string;
  args: string[];
  displayCommand: string;
};

export type AgentSessionScanOptions = {
  homeDirectory?: string;
  env?: NodeJS.ProcessEnv;
  codexThreadTitles?: ReadonlyMap<string, string>;
  searchTerm?: string;
};

type ProjectIdentity = Pick<ProjectSummary, "id" | "name" | "path">;
type JsonRecord = Record<string, unknown>;
type SessionCandidate = Omit<AgentSessionSummary, "projectId" | "projectName" | "projectPath"> & {
  cwd: string;
};

const PROVIDERS: Array<{
  id: AgentSessionProvider;
  label: string;
  commandEnv: string;
  defaultCommand: string;
}> = [
  { id: "claude", label: "Claude Code", commandEnv: "REPO_CONTROL_CLAUDE", defaultCommand: "claude" },
  { id: "codex", label: "Codex", commandEnv: "REPO_CONTROL_CODEX", defaultCommand: "codex" },
  { id: "gemini", label: "Gemini CLI", commandEnv: "REPO_CONTROL_GEMINI", defaultCommand: "gemini" }
];
const MAX_TRANSCRIPT_BYTES = 1024 * 1024;
const MAX_METADATA_LINE_BYTES = 256 * 1024;
const MAX_JSON_BYTES = 10 * 1024 * 1024;
const MAX_SESSION_FILES = 5000;
const TRANSCRIPT_READ_CONCURRENCY = 16;

export async function scanAgentSessions(
  rootPath: string,
  projects: ProjectIdentity[],
  options: AgentSessionScanOptions = {}
): Promise<AgentSessionsResponse> {
  const homeDirectory = options.homeDirectory ?? os.homedir();
  const env = options.env ?? process.env;
  const searchTerm = compactText(options.searchTerm ?? "").slice(0, 200);
  const warnings: string[] = [];
  const providerCommands = new Map(
    PROVIDERS.map((provider) => [
      provider.id,
      env[provider.commandEnv]?.trim() || provider.defaultCommand
    ])
  );
  const candidatesByProvider = await Promise.all([
    readClaudeSessions(homeDirectory, env, searchTerm).catch((error) => {
      warnings.push(getScanWarning("Claude Code", error));
      return [];
    }),
    readCodexSessions(homeDirectory, env, options.codexThreadTitles, searchTerm).catch((error) => {
      warnings.push(getScanWarning("Codex", error));
      return [];
    }),
    readGeminiSessions(homeDirectory, projects, searchTerm).catch((error) => {
      warnings.push(getScanWarning("Gemini CLI", error));
      return [];
    })
  ]);

  const projectsBySpecificity = [...projects].sort((left, right) => right.path.length - left.path.length);
  const allSessions = dedupeSessions(candidatesByProvider
    .flat()
    .map((candidate) => attachProject(candidate, projectsBySpecificity))
    .filter((session): session is AgentSessionSummary => session !== null))
    .sort(sortSessions);
  const sessions = searchTerm
    ? allSessions.filter((session) => session.match !== null)
    : allSessions;
  const installationChecks = await Promise.all(
    PROVIDERS.map(async (provider) => ({
      provider,
      installed: await isExecutableAvailable(providerCommands.get(provider.id) ?? provider.defaultCommand, env)
    }))
  );

  return {
    root: path.resolve(rootPath),
    agents: installationChecks.map(({ provider, installed }) => {
      const sessionCount = allSessions.filter((session) => session.provider === provider.id).length;

      return {
        id: provider.id,
        label: provider.label,
        installed,
        used: sessionCount > 0,
        command: providerCommands.get(provider.id) ?? provider.defaultCommand,
        sessionCount
      };
    }),
    sessions,
    scannedAt: new Date().toISOString(),
    warnings
  };
}

export function getAgentResumeSpec(
  provider: AgentSessionProvider,
  sessionId: string,
  env: NodeJS.ProcessEnv = process.env
): AgentResumeSpec {
  const providerConfig = PROVIDERS.find((item) => item.id === provider);

  if (!providerConfig) {
    throw new Error("Unsupported agent provider");
  }

  const command = env[providerConfig.commandEnv]?.trim() || providerConfig.defaultCommand;
  const args = provider === "codex"
    ? ["resume", sessionId]
    : ["--resume", sessionId];

  return {
    command,
    args,
    displayCommand: [shellQuote(command), ...args.map(shellQuote)].join(" ")
  };
}

export function findAgentSession(
  response: AgentSessionsResponse,
  provider: AgentSessionProvider,
  sessionId: string,
  projectId: string
): AgentSessionSummary | null {
  return response.sessions.find(
    (session) =>
      session.provider === provider
      && session.id === sessionId
      && session.projectId === projectId
  ) ?? null;
}

async function readCodexSessions(
  homeDirectory: string,
  env: NodeJS.ProcessEnv,
  providedThreadTitles: ReadonlyMap<string, string> | undefined,
  searchTerm: string
): Promise<SessionCandidate[]> {
  const codexHome = env.CODEX_HOME?.trim() || path.join(homeDirectory, ".codex");
  const [files, threadTitles] = await Promise.all([
    listTranscriptFiles(path.join(codexHome, "sessions"), [".jsonl"]),
    providedThreadTitles
      ? Promise.resolve(providedThreadTitles)
      : readCodexThreadTitles(codexHome)
  ]);

  return mapDefined(files, async (filePath) => {
    const [rows, stat] = await Promise.all([
      readJsonLines(filePath),
      fs.stat(filePath).catch(() => null)
    ]);
    const metadataRow = rows.find((row) => row.type === "session_meta");
    const payload = isRecord(metadataRow?.payload) ? metadataRow.payload : null;
    const cwd = firstString(payload?.cwd);
    const sessionId = firstString(payload?.id, payload?.session_id) ?? getSessionIdFromFile(filePath);

    if (!cwd || !sessionId) {
      return null;
    }

    const git = isRecord(payload?.git) ? payload.git : null;
    const prompt = rows.map(getCodexUserMessage).find(isUsefulPrompt) ?? null;
    const threadTitle = firstString(
      payload?.name,
      payload?.title,
      threadTitles.get(sessionId)
    );
    const title = threadTitle
      ? truncateText(compactText(threadTitle), 96)
      : prompt
        ? truncateText(compactText(prompt), 96)
        : `Codex session ${shortId(sessionId)}`;
    const startedAt = firstString(payload?.timestamp);
    const match = searchTerm
      ? createSearchMatch(title, searchTerm, "title")
        ?? await findJsonLinesSearchMatch(filePath, getCodexConversationMessage, searchTerm)
      : null;

    return {
      id: sessionId,
      provider: "codex",
      providerLabel: "Codex",
      cwd,
      title,
      preview: prompt ? truncateText(compactText(prompt), 240) : null,
      branch: firstString(git?.branch),
      startedAt,
      updatedAt: stat?.mtime.toISOString() ?? startedAt,
      match
    };
  });
}

async function readClaudeSessions(
  homeDirectory: string,
  env: NodeJS.ProcessEnv,
  searchTerm: string
): Promise<SessionCandidate[]> {
  const claudeHome = env.CLAUDE_CONFIG_DIR?.trim() || path.join(homeDirectory, ".claude");
  const files = await listClaudeTranscriptFiles(path.join(claudeHome, "projects"));

  return mapDefined(files, async (filePath) => {
    const [rows, stat] = await Promise.all([
      readJsonLines(filePath),
      fs.stat(filePath).catch(() => null)
    ]);
    const cwd = rows.map((row) => firstString(row.cwd)).find(Boolean) ?? null;
    const sessionId =
      rows.map((row) => firstString(row.sessionId, row.session_id)).find(Boolean)
      ?? getSessionIdFromFile(filePath);

    if (!cwd || !sessionId) {
      return null;
    }

    const customTitle = rows
      .filter((row) => row.type === "custom-title")
      .map((row) => firstString(row.customTitle, row.title))
      .find(Boolean);
    const generatedTitle = rows
      .filter((row) => row.type === "ai-title")
      .map((row) => firstString(row.aiTitle, row.title, row.summary))
      .find(Boolean);
    const title =
      customTitle
      ?? generatedTitle
      ?? rows.map(getClaudeUserMessage).find(isUsefulPrompt)
      ?? null;
    const preview = rows.map(getClaudeUserMessage).find(isUsefulPrompt) ?? null;
    const timestamps = rows.map((row) => firstString(row.timestamp)).filter(isString);
    const displayTitle = title
      ? truncateText(compactText(title), 96)
      : `Claude session ${shortId(sessionId)}`;
    const match = searchTerm
      ? createSearchMatch(displayTitle, searchTerm, "title")
        ?? await findJsonLinesSearchMatch(filePath, getClaudeConversationMessage, searchTerm)
      : null;

    return {
      id: sessionId,
      provider: "claude",
      providerLabel: "Claude Code",
      cwd,
      title: displayTitle,
      preview: preview ? truncateText(compactText(preview), 240) : null,
      branch: rows.map((row) => firstString(row.gitBranch)).find(Boolean) ?? null,
      startedAt: timestamps[0] ?? null,
      updatedAt: latestTimestamp(
        timestamps[timestamps.length - 1] ?? null,
        stat?.mtime.toISOString() ?? null
      ),
      match
    };
  });
}

async function readGeminiSessions(
  homeDirectory: string,
  projects: ProjectIdentity[],
  searchTerm: string
): Promise<SessionCandidate[]> {
  const geminiHome = path.join(homeDirectory, ".gemini");
  const tmpDirectory = path.join(geminiHome, "tmp");
  const projectMappings = await readGeminiProjectMappings(geminiHome, projects);
  const directories = await fs.readdir(tmpDirectory, { withFileTypes: true }).catch(() => []);
  const sessionGroups = await Promise.all(
    directories
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const sessionDirectory = path.join(tmpDirectory, entry.name);
        const projectRoot = await fs
          .readFile(path.join(sessionDirectory, ".project_root"), "utf8")
          .then((value) => value.trim())
          .catch(() => projectMappings.get(entry.name) ?? null);

        if (!projectRoot) {
          return [];
        }

        const files = await listTranscriptFiles(path.join(sessionDirectory, "chats"), [".json", ".jsonl"]);
        return mapDefined(files, (filePath) => readGeminiSession(filePath, projectRoot, searchTerm));
      })
  );

  return sessionGroups.flat();
}

async function readGeminiProjectMappings(
  geminiHome: string,
  projects: ProjectIdentity[]
): Promise<Map<string, string>> {
  const mappings = new Map<string, string>();
  const projectsJson = await fs.readFile(path.join(geminiHome, "projects.json"), "utf8").catch(() => "");
  const parsed = parseJson(projectsJson);
  const storedProjects = isRecord(parsed) && isRecord(parsed.projects) ? parsed.projects : {};

  for (const [projectPath, projectKey] of Object.entries(storedProjects)) {
    if (typeof projectKey === "string" && projectKey.trim()) {
      mappings.set(projectKey, projectPath);
    }
  }

  for (const project of projects) {
    mappings.set(createHash("sha256").update(path.resolve(project.path)).digest("hex"), project.path);
  }

  return mappings;
}

async function readGeminiSession(
  filePath: string,
  cwd: string,
  searchTerm: string
): Promise<SessionCandidate | null> {
  const stat = await fs.stat(filePath).catch(() => null);
  const isJsonLines = filePath.endsWith(".jsonl");
  let metadata: JsonRecord | null;
  let messages: JsonRecord[];

  if (isJsonLines) {
    const rows = await readJsonLines(filePath);
    metadata = rows[0] ?? null;
    messages = rows;
  } else {
    if ((stat?.size ?? 0) > MAX_JSON_BYTES) {
      return null;
    }

    const parsed = parseJson(await fs.readFile(filePath, "utf8").catch(() => ""));
    metadata = isRecord(parsed) ? parsed : null;
    messages = metadata && Array.isArray(metadata.messages)
      ? metadata.messages.filter(isRecord)
      : [];
  }

  if (!metadata) {
    return null;
  }

  const sessionId = firstString(metadata.sessionId, metadata.session_id) ?? getSessionIdFromFile(filePath);

  if (!sessionId) {
    return null;
  }

  const prompt = messages.map(getGeminiUserMessage).find(isUsefulPrompt) ?? null;
  const threadTitle = firstString(metadata.name, metadata.title, metadata.summary);
  const timestamps = messages.map((message) => firstString(message.timestamp)).filter(isString);
  const startedAt = firstString(metadata.startTime, metadata.start_time) ?? timestamps[0] ?? null;
  const updatedAt =
    firstString(metadata.lastUpdated, metadata.last_updated)
    ?? timestamps[timestamps.length - 1]
    ?? stat?.mtime.toISOString()
    ?? null;
  const title = threadTitle
    ? truncateText(compactText(threadTitle), 96)
    : prompt
      ? truncateText(compactText(prompt), 96)
      : `Gemini session ${shortId(sessionId)}`;
  const match = searchTerm
    ? createSearchMatch(title, searchTerm, "title")
      ?? (isJsonLines
        ? await findJsonLinesSearchMatch(filePath, getGeminiConversationMessage, searchTerm)
        : findRowsSearchMatch(messages, getGeminiConversationMessage, searchTerm))
    : null;

  return {
    id: sessionId,
    provider: "gemini",
    providerLabel: "Gemini CLI",
    cwd,
    title,
    preview: prompt ? truncateText(compactText(prompt), 240) : null,
    branch: null,
    startedAt,
    updatedAt,
    match
  };
}

function attachProject(candidate: SessionCandidate, projects: ProjectIdentity[]): AgentSessionSummary | null {
  const cwd = path.resolve(candidate.cwd);
  const project = projects.find((item) => isPathInside(path.resolve(item.path), cwd));

  if (!project) {
    return null;
  }

  return {
    id: candidate.id,
    provider: candidate.provider,
    providerLabel: candidate.providerLabel,
    projectId: project.id,
    projectName: project.name,
    projectPath: project.path,
    title: candidate.title,
    preview: candidate.preview,
    branch: candidate.branch,
    startedAt: candidate.startedAt,
    updatedAt: candidate.updatedAt,
    match: candidate.match
  };
}

function isPathInside(parentPath: string, childPath: string): boolean {
  const relativePath = path.relative(parentPath, childPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

async function listTranscriptFiles(directory: string, extensions: string[]): Promise<string[]> {
  const files: string[] = [];

  async function visit(currentDirectory: string): Promise<void> {
    if (files.length >= MAX_SESSION_FILES) {
      return;
    }

    const entries = await fs.readdir(currentDirectory, { withFileTypes: true }).catch(() => []);

    for (const entry of entries) {
      if (files.length >= MAX_SESSION_FILES) {
        break;
      }

      const entryPath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        await visit(entryPath);
      } else if (entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension))) {
        files.push(entryPath);
      }
    }
  }

  await visit(directory);
  return files;
}

async function listClaudeTranscriptFiles(projectsDirectory: string): Promise<string[]> {
  const projectDirectories = await fs.readdir(projectsDirectory, { withFileTypes: true }).catch(() => []);
  const transcriptGroups = await Promise.all(
    projectDirectories
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const projectDirectory = path.join(projectsDirectory, entry.name);
        const files = await fs.readdir(projectDirectory, { withFileTypes: true }).catch(() => []);

        return files
          .filter((file) => file.isFile() && file.name.endsWith(".jsonl"))
          .map((file) => path.join(projectDirectory, file.name));
      })
  );

  return transcriptGroups.flat().slice(0, MAX_SESSION_FILES);
}

async function readCodexThreadTitles(codexHome: string): Promise<ReadonlyMap<string, string>> {
  const titles = new Map<string, string>();
  const nodeMajorVersion = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);

  if (nodeMajorVersion < 22) {
    return titles;
  }

  const entries = await fs.readdir(codexHome, { withFileTypes: true }).catch(() => []);
  const stateDatabases = entries
    .filter((entry) => entry.isFile() && /^state_\d+\.sqlite$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => getStateDatabaseVersion(right) - getStateDatabaseVersion(left));
  const sqliteModuleName = "node:sqlite";

  for (const databaseName of stateDatabases) {
    let database: SqliteDatabase | null = null;

    try {
      const sqliteModule = await import(sqliteModuleName) as unknown as {
        DatabaseSync: SqliteDatabaseConstructor;
      };
      database = new sqliteModule.DatabaseSync(path.join(codexHome, databaseName), { readOnly: true });
      const rows = readCodexTitleRows(database);

      for (const row of rows) {
        const id = firstString(row.id);
        const title = firstString(row.display_title);

        if (id && title && !titles.has(id)) {
          titles.set(id, title);
        }
      }

      if (titles.size > 0) {
        return titles;
      }
    } catch {
      // The state index is optional and versioned; transcript parsing remains the fallback.
    } finally {
      database?.close();
    }
  }

  return titles;
}

type SqliteRow = Record<string, unknown>;
type SqliteDatabase = {
  prepare: (sql: string) => {
    all: (...params: unknown[]) => SqliteRow[];
  };
  close: () => void;
};
type SqliteDatabaseConstructor = new (
  filePath: string,
  options: { readOnly: boolean }
) => SqliteDatabase;

function readCodexTitleRows(database: SqliteDatabase): SqliteRow[] {
  try {
    return database.prepare(
      "SELECT id, COALESCE(NULLIF(name, ''), NULLIF(title, '')) AS display_title FROM threads"
    ).all();
  } catch {
    return database.prepare(
      "SELECT id, NULLIF(title, '') AS display_title FROM threads"
    ).all();
  }
}

function getStateDatabaseVersion(fileName: string): number {
  return Number.parseInt(fileName.match(/^state_(\d+)\.sqlite$/)?.[1] ?? "0", 10);
}

async function readJsonLines(filePath: string): Promise<JsonRecord[]> {
  const file = await fs.open(filePath, "r").catch(() => null);

  if (!file) {
    return [];
  }

  try {
    const stat = await file.stat();
    const buffer = Buffer.alloc(Math.min(stat.size, MAX_TRANSCRIPT_BYTES));
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);

    let content = buffer
      .subarray(0, bytesRead)
      .toString("utf8");

    if (bytesRead < stat.size) {
      content = content.slice(0, Math.max(0, content.lastIndexOf("\n")));
    }

    return content
      .split("\n")
      .filter((line) => line.length <= MAX_METADATA_LINE_BYTES)
      .map(parseJson)
      .filter(isRecord);
  } finally {
    await file.close();
  }
}

async function findJsonLinesSearchMatch(
  filePath: string,
  getConversationMessage: (row: JsonRecord) => string | null,
  searchTerm: string
): Promise<AgentSessionSearchMatch | null> {
  const input = createReadStream(filePath, { encoding: "utf8" });
  const lines = createInterface({ input, crlfDelay: Infinity });
  const searchProbe = getSearchProbe(searchTerm);

  try {
    for await (const line of lines) {
      if (!line.toLocaleLowerCase("it").includes(searchProbe)) {
        continue;
      }

      const row = parseJson(line);

      if (!isRecord(row)) {
        continue;
      }

      const match = createSearchMatch(getConversationMessage(row), searchTerm, "content");

      if (match) {
        return match;
      }
    }
  } catch {
    return null;
  } finally {
    lines.close();
    input.destroy();
  }

  return null;
}

function getSearchProbe(searchTerm: string): string {
  return compactText(searchTerm)
    .toLocaleLowerCase("it")
    .split(" ")
    .sort((left, right) => right.length - left.length)[0]
    ?? "";
}

function findRowsSearchMatch(
  rows: JsonRecord[],
  getConversationMessage: (row: JsonRecord) => string | null,
  searchTerm: string
): AgentSessionSearchMatch | null {
  for (const row of rows) {
    const match = createSearchMatch(getConversationMessage(row), searchTerm, "content");

    if (match) {
      return match;
    }
  }

  return null;
}

function createSearchMatch(
  value: string | null,
  searchTerm: string,
  field: AgentSessionSearchMatch["field"]
): AgentSessionSearchMatch | null {
  if (!value || !searchTerm) {
    return null;
  }

  const text = compactText(value);
  const normalizedText = text.toLocaleLowerCase("it");
  const normalizedSearch = compactText(searchTerm).toLocaleLowerCase("it");
  const matchIndex = normalizedText.indexOf(normalizedSearch);

  if (matchIndex === -1) {
    return null;
  }

  const maxSnippetLength = 240;
  const contextLength = Math.max(24, Math.floor((maxSnippetLength - normalizedSearch.length) / 2));
  const start = Math.max(0, matchIndex - contextLength);
  const end = Math.min(text.length, matchIndex + normalizedSearch.length + contextLength);

  return {
    field,
    snippet: `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`
  };
}

async function mapDefined<T, R>(
  items: T[],
  mapItem: (item: T) => Promise<R | null>
): Promise<Awaited<R>[]> {
  const results: Array<Awaited<R> | null> = new Array(items.length).fill(null);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      results[itemIndex] = await mapItem(items[itemIndex]);
    }
  }

  const workerCount = Math.min(TRANSCRIPT_READ_CONCURRENCY, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results.filter((item): item is Awaited<R> => item !== null);
}

function getCodexUserMessage(row: JsonRecord): string | null {
  if (row.type === "response_item" && isRecord(row.payload) && row.payload.role === "user") {
    return extractTextContent(row.payload.content);
  }

  if (row.type === "event_msg" && isRecord(row.payload) && row.payload.type === "user_message") {
    return firstString(row.payload.message);
  }

  return null;
}

function getCodexConversationMessage(row: JsonRecord): string | null {
  if (row.type === "response_item" && isRecord(row.payload)) {
    const message = row.payload.role === "user" || row.payload.role === "assistant"
      ? extractTextContent(row.payload.content)
      : null;
    return row.payload.role === "user" && !isUsefulPrompt(message) ? null : message;
  }

  if (row.type === "event_msg" && isRecord(row.payload)) {
    const message = firstString(row.payload.message);

    if (row.payload.type === "user_message") {
      return isUsefulPrompt(message) ? message : null;
    }

    return row.payload.type === "agent_message" ? message : null;
  }

  return null;
}

function getClaudeUserMessage(row: JsonRecord): string | null {
  if (row.type !== "user" || !isRecord(row.message)) {
    return null;
  }

  return extractTextContent(row.message.content);
}

function getClaudeConversationMessage(row: JsonRecord): string | null {
  if ((row.type !== "user" && row.type !== "assistant") || !isRecord(row.message)) {
    return null;
  }

  const message = extractTextContent(row.message.content);
  return row.type === "user" && !isUsefulPrompt(message) ? null : message;
}

function getGeminiUserMessage(row: JsonRecord): string | null {
  if (row.type !== "user") {
    return null;
  }

  return firstString(row.displayContent, row.content) ?? extractTextContent(row.content);
}

function getGeminiConversationMessage(row: JsonRecord): string | null {
  const role = firstString(row.type, row.role)?.toLocaleLowerCase("en");

  if (!role || !["user", "assistant", "model", "gemini"].includes(role)) {
    return null;
  }

  const message = firstString(row.displayContent, row.content) ?? extractTextContent(row.content);
  return role === "user" && !isUsefulPrompt(message) ? null : message;
}

function extractTextContent(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (!Array.isArray(value)) {
    return isRecord(value) && typeof value.text === "string" ? value.text.trim() || null : null;
  }

  const text = value
    .filter((item) => !isRecord(item) || (item.type !== "tool_result" && item.type !== "tool_use"))
    .map((item) => {
      if (typeof item === "string") return item;
      if (!isRecord(item)) return "";
      return firstString(item.text, item.content) ?? "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();

  return text || null;
}

function isUsefulPrompt(value: string | null): value is string {
  if (!value) {
    return false;
  }

  const normalized = value.trim();
  return normalized.length > 0
    && !normalized.startsWith("<environment_context>")
    && !normalized.startsWith("<permissions instructions>")
    && !normalized.startsWith("<system-reminder>")
    && !normalized.startsWith("<local-command-")
    && !normalized.startsWith("<command-name>");
}

async function isExecutableAvailable(command: string, env: NodeJS.ProcessEnv): Promise<boolean> {
  if (command.includes("/") || command.includes("\\")) {
    return fs.access(command, fsConstants.X_OK).then(() => true).catch(() => false);
  }

  const pathValue = env.PATH ?? "";
  const pathExtensions = process.platform === "win32"
    ? (env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];

  for (const directory of pathValue.split(path.delimiter).filter(Boolean)) {
    for (const extension of pathExtensions) {
      const candidate = path.join(directory, `${command}${extension}`);
      const available = await fs.access(candidate, fsConstants.X_OK).then(() => true).catch(() => false);

      if (available) {
        return true;
      }
    }
  }

  return false;
}

function getSessionIdFromFile(filePath: string): string | null {
  const name = path.basename(filePath).replace(/\.jsonl?$/, "");
  const uuid = name.match(/[0-9a-f]{8}-[0-9a-f-]{27,}/i)?.[0];
  return uuid ?? null;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | null {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() ?? null;
}

function isString(value: string | null): value is string {
  return value !== null;
}

function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

function shortId(value: string): string {
  return value.slice(0, 8);
}

function sortSessions(left: AgentSessionSummary, right: AgentSessionSummary): number {
  return getTimestamp(right.updatedAt ?? right.startedAt)
    - getTimestamp(left.updatedAt ?? left.startedAt);
}

function dedupeSessions(sessions: AgentSessionSummary[]): AgentSessionSummary[] {
  const sessionsByResumeTarget = new Map<string, AgentSessionSummary>();

  for (const session of sessions) {
    const key = `${session.provider}\0${session.projectId}\0${session.id}`;
    const current = sessionsByResumeTarget.get(key);

    if (!current || sortSessions(session, current) < 0) {
      sessionsByResumeTarget.set(key, session);
    }
  }

  return [...sessionsByResumeTarget.values()];
}

function latestTimestamp(...values: Array<string | null>): string | null {
  return values
    .filter(isString)
    .sort((left, right) => getTimestamp(right) - getTimestamp(left))[0]
    ?? null;
}

function getTimestamp(value: string | null): number {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function shellQuote(value: string): string {
  return /^[A-Za-z0-9_./:-]+$/.test(value)
    ? value
    : `'${value.replace(/'/g, `'\\''`)}'`;
}

function getScanWarning(provider: string, error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown error";
  return `${provider}: ${message}`;
}
