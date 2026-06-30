import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

export type UserPreferences = {
  favoriteProjectIds: string[];
};

const DEFAULT_PREFERENCES: UserPreferences = {
  favoriteProjectIds: []
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

export async function writePreferences(preferences: UserPreferences): Promise<UserPreferences> {
  const preferencesPath = getPreferencesPath();
  const nextPreferences = normalizePreferences(preferences);

  await fs.mkdir(path.dirname(preferencesPath), { recursive: true });
  await fs.writeFile(`${preferencesPath}.tmp`, `${JSON.stringify(nextPreferences, null, 2)}\n`, "utf8");
  await fs.rename(`${preferencesPath}.tmp`, preferencesPath);

  return nextPreferences;
}

function getPreferencesPath(): string {
  return path.join(getConfigDirectory(), "preferences.json");
}

function getConfigDirectory(): string {
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
  const rawFavoriteProjectIds =
    typeof value === "object" && value !== null && "favoriteProjectIds" in value
      ? (value as { favoriteProjectIds?: unknown }).favoriteProjectIds
      : [];

  return {
    favoriteProjectIds: Array.isArray(rawFavoriteProjectIds)
      ? uniqueStrings(rawFavoriteProjectIds.filter((projectId): projectId is string => typeof projectId === "string"))
      : []
  };
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
