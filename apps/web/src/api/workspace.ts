import type { UserPreferences } from "../types/workspace";
import { jsonRequest, requestJson } from "./http";

export function setRootPath(root: string): Promise<{ root: string }> {
  return requestJson("/api/root", "Unable to change folder", jsonRequest("POST", { root }));
}

export function fetchPreferences(): Promise<UserPreferences> {
  return requestJson("/api/preferences", "Unable to load local preferences");
}

// The server merges a partial document over what it has stored and answers with the
// whole record, so each caller sends only the preference it owns.
export function updatePreferences(
  patch: Partial<UserPreferences>,
  options: { keepalive?: boolean } = {}
): Promise<UserPreferences> {
  return requestJson(
    "/api/preferences",
    "Unable to save local preferences",
    // `keepalive` lets a save started as the page unloads finish after it is gone.
    { ...jsonRequest("PUT", patch), keepalive: options.keepalive === true }
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
