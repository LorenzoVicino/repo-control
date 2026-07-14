import type { UserPreferences } from "../types/workspace";
import { jsonRequest, requestJson } from "./http";

export function setRootPath(root: string): Promise<{ root: string }> {
  return requestJson("/api/root", "Unable to change folder", jsonRequest("POST", { root }));
}

export function fetchPreferences(): Promise<UserPreferences> {
  return requestJson("/api/preferences", "Unable to load local preferences");
}

export function updatePreferences(preferences: UserPreferences): Promise<UserPreferences> {
  return requestJson(
    "/api/preferences",
    "Unable to save local preferences",
    jsonRequest("PUT", preferences)
  );
}

export async function pickWorkspaceFolder(initialPath: string): Promise<string | null> {
  const payload = await requestJson<{ cancelled?: boolean; path?: unknown }>(
    "/api/folder-picker",
    "Unable to pick folder",
    jsonRequest("POST", { initialPath })
  );

  if (payload.cancelled) return null;
  if (typeof payload.path === "string") return payload.path;
  throw new Error("Folder picker returned no path");
}
