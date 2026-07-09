import { promises as fs } from "node:fs";
import path from "node:path";
import { getConfigDirectory } from "./preferences.js";

export type TerminalSuggestionsResponse = {
  suggestions: string[];
};

type TerminalHistoryEntry = {
  command: string;
  projectPath: string;
  count: number;
  lastUsedAt: string;
};

type TerminalHistoryFile = {
  version: 1;
  entries: TerminalHistoryEntry[];
};

const MAX_TERMINAL_HISTORY_ENTRIES = 500;
const MAX_COMMAND_LENGTH = 2000;
const MAX_SUGGESTIONS = 3;

export async function rememberTerminalCommand(projectPath: string, command: string): Promise<void> {
  const normalizedCommand = normalizeCommand(command);

  if (!normalizedCommand) {
    return;
  }

  const history = await readTerminalHistory();
  const now = new Date().toISOString();
  const existingEntry = history.entries.find(
    (entry) => entry.projectPath === projectPath && entry.command === normalizedCommand
  );

  if (existingEntry) {
    existingEntry.count += 1;
    existingEntry.lastUsedAt = now;
  } else {
    history.entries.push({
      command: normalizedCommand,
      projectPath,
      count: 1,
      lastUsedAt: now
    });
  }

  history.entries = history.entries
    .sort(sortTerminalHistoryEntries)
    .slice(0, MAX_TERMINAL_HISTORY_ENTRIES);

  await writeTerminalHistory(history);
}

export async function readTerminalSuggestions(
  projectPath: string,
  input: string,
  limit = MAX_SUGGESTIONS
): Promise<TerminalSuggestionsResponse> {
  const normalizedInput = normalizeCommand(input);

  if (!normalizedInput) {
    return { suggestions: [] };
  }

  const history = await readTerminalHistory();
  const inputLower = normalizedInput.toLowerCase();
  const suggestions = history.entries
    .filter((entry) => entry.command.length > normalizedInput.length)
    .filter((entry) => entry.command.toLowerCase().startsWith(inputLower))
    .sort((left, right) => {
      if (left.projectPath !== right.projectPath) {
        return left.projectPath === projectPath ? -1 : right.projectPath === projectPath ? 1 : 0;
      }

      return sortTerminalHistoryEntries(left, right);
    })
    .map((entry) => entry.command);

  return {
    suggestions: uniqueStrings(suggestions).slice(0, Math.max(1, Math.min(MAX_SUGGESTIONS, limit)))
  };
}

function sortTerminalHistoryEntries(left: TerminalHistoryEntry, right: TerminalHistoryEntry): number {
  if (right.count !== left.count) {
    return right.count - left.count;
  }

  return Date.parse(right.lastUsedAt) - Date.parse(left.lastUsedAt);
}

async function readTerminalHistory(): Promise<TerminalHistoryFile> {
  const historyPath = getTerminalHistoryPath();
  const content = await fs.readFile(historyPath, "utf8").catch(() => null);

  if (!content) {
    return createEmptyTerminalHistory();
  }

  try {
    return normalizeTerminalHistory(JSON.parse(content));
  } catch {
    return createEmptyTerminalHistory();
  }
}

async function writeTerminalHistory(history: TerminalHistoryFile): Promise<void> {
  const historyPath = getTerminalHistoryPath();
  const normalizedHistory = normalizeTerminalHistory(history);

  await fs.mkdir(path.dirname(historyPath), { recursive: true });
  await fs.writeFile(`${historyPath}.tmp`, `${JSON.stringify(normalizedHistory, null, 2)}\n`, "utf8");
  await fs.rename(`${historyPath}.tmp`, historyPath);
}

function getTerminalHistoryPath(): string {
  return path.join(getConfigDirectory(), "terminal-history.json");
}

function normalizeTerminalHistory(value: unknown): TerminalHistoryFile {
  const rawEntries =
    typeof value === "object" && value !== null && "entries" in value
      ? (value as { entries?: unknown }).entries
      : [];

  const entries = Array.isArray(rawEntries)
    ? rawEntries
        .map(normalizeTerminalHistoryEntry)
        .filter((entry): entry is TerminalHistoryEntry => entry !== null)
        .sort(sortTerminalHistoryEntries)
        .slice(0, MAX_TERMINAL_HISTORY_ENTRIES)
    : [];

  return {
    version: 1,
    entries
  };
}

function normalizeTerminalHistoryEntry(value: unknown): TerminalHistoryEntry | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const entry = value as Partial<TerminalHistoryEntry>;
  const command = normalizeCommand(entry.command);
  const projectPath = typeof entry.projectPath === "string" ? entry.projectPath : "";

  if (!command || !projectPath) {
    return null;
  }

  return {
    command,
    projectPath,
    count: Number.isFinite(entry.count) ? Math.max(1, Number(entry.count)) : 1,
    lastUsedAt: typeof entry.lastUsedAt === "string" ? entry.lastUsedAt : new Date(0).toISOString()
  };
}

function createEmptyTerminalHistory(): TerminalHistoryFile {
  return {
    version: 1,
    entries: []
  };
}

function normalizeCommand(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, MAX_COMMAND_LENGTH) : "";
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
