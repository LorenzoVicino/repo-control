import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export type DashboardWidgetSize = "small" | "medium" | "large";

export type DashboardWidgetPlacement = {
  id: string;
  size: DashboardWidgetSize;
  hidden: boolean;
};

// The server stores the layout as the browser sends it and only guarantees its shape;
// which widget ids exist, and which sizes each supports, is the interface's knowledge
// and is enforced there when the layout is read back.
export type DashboardLayoutPreference = {
  version: 1;
  widgets: DashboardWidgetPlacement[];
};

export type UserPreferences = {
  favoriteProjectIds: string[];
  // Most recently opened first, capped. Written by the interface each time a repository
  // workspace is opened so the dashboard can offer the last few as a place to resume.
  recentProjectIds: string[];
  dashboard: DashboardLayoutPreference | null;
};

export const MAX_RECENT_PROJECT_IDS = 8;
const MAX_DASHBOARD_WIDGETS = 32;
const DASHBOARD_WIDGET_SIZES: readonly DashboardWidgetSize[] = ["small", "medium", "large"];

const DEFAULT_PREFERENCES: UserPreferences = {
  favoriteProjectIds: [],
  recentProjectIds: [],
  dashboard: null
};

export async function readPreferences(): Promise<UserPreferences> {
  const preferencesPath = getPreferencesPath();
  const content = await fs.readFile(preferencesPath, "utf8").catch(() => null);

  if (!content) {
    return DEFAULT_PREFERENCES;
  }

  try {
    return normalizePreferences(JSON.parse(content));
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

// Accepts a partial document and merges it over what is stored, so a caller that owns one
// preference - favorites, the dashboard layout - cannot erase another it never read.
export async function writePreferences(patch: Partial<UserPreferences>): Promise<UserPreferences> {
  const preferencesPath = getPreferencesPath();
  const currentPreferences = await readPreferences();
  const nextPreferences = normalizePreferences({ ...currentPreferences, ...patch });

  await fs.mkdir(path.dirname(preferencesPath), { recursive: true });
  await fs.writeFile(`${preferencesPath}.tmp`, `${JSON.stringify(nextPreferences, null, 2)}\n`, "utf8");
  await fs.rename(`${preferencesPath}.tmp`, preferencesPath);

  return nextPreferences;
}

function getPreferencesPath(): string {
  return path.join(getConfigDirectory(), "preferences.json");
}

export function getConfigDirectory(): string {
  if (process.env.REPO_CONTROL_CONFIG_DIR) {
    return path.resolve(process.env.REPO_CONTROL_CONFIG_DIR);
  }

  if (process.platform === "win32") {
    const appDataPath =
      process.env.APPDATA ??
      process.env.LOCALAPPDATA ??
      path.join(os.homedir(), "AppData", "Roaming");

    return path.join(appDataPath, "repo-control");
  }

  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "repo-control");
  }

  return path.join(process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config"), "repo-control");
}

function normalizePreferences(value: unknown): UserPreferences {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  return {
    favoriteProjectIds: normalizeProjectIds(record.favoriteProjectIds),
    recentProjectIds: normalizeProjectIds(record.recentProjectIds).slice(0, MAX_RECENT_PROJECT_IDS),
    dashboard: normalizeDashboardLayout(record.dashboard)
  };
}

function normalizeProjectIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(value.filter((projectId): projectId is string => typeof projectId === "string" && projectId.length > 0));
}

function normalizeDashboardLayout(value: unknown): DashboardLayoutPreference | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.widgets)) return null;

  const seenIds = new Set<string>();
  const widgets: DashboardWidgetPlacement[] = [];

  for (const entry of record.widgets) {
    if (typeof entry !== "object" || entry === null) continue;
    const { id, size, hidden } = entry as Record<string, unknown>;
    if (typeof id !== "string" || id.length === 0 || seenIds.has(id)) continue;
    if (!DASHBOARD_WIDGET_SIZES.includes(size as DashboardWidgetSize)) continue;
    seenIds.add(id);
    widgets.push({ id, size: size as DashboardWidgetSize, hidden: hidden === true });
    if (widgets.length >= MAX_DASHBOARD_WIDGETS) break;
  }

  return { version: 1, widgets };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
