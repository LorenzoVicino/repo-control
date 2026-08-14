import type { CommandResult } from "../types/common";
import type { GitActivity, GitDetails, GitFileDiff } from "../types/git";
import type { ProjectSummary, ProjectsResponse } from "../types/projects";
import { isRecord, jsonRequest, requestJson } from "./http";

export function fetchProjects(): Promise<ProjectsResponse> {
  return requestJson("/api/projects", "Unable to load projects");
}

export function fetchProjectSummary(projectId: string): Promise<ProjectSummary> {
  return requestJson(`/api/projects/${projectId}/summary`, "Unable to refresh project");
}

export async function runProjectAction(
  projectId: string,
  actionPath: string,
  label: string,
  body?: unknown
): Promise<CommandResult> {
  const init = body === undefined
    ? { method: "POST" as const }
    : jsonRequest("POST", body);
  const payload = await requestJson<unknown>(
    `/api/projects/${projectId}/${actionPath}`,
    "Action failed",
    init
  );

  if (isRecord(payload) && "command" in payload) {
    return payload as CommandResult;
  }

  return {
    ok: true,
    command: label,
    exitCode: 0,
    stdout: "",
    stderr: "",
    output: "Requested",
    durationMs: 0
  };
}

export function fetchGitDetails(projectId: string): Promise<GitDetails> {
  return requestJson(`/api/projects/${projectId}/git/details`, "Unable to load Git details");
}

export function fetchGitActivity(
  projectId: string,
  options: { offset: number; limit: number }
): Promise<GitActivity> {
  const searchParams = new URLSearchParams({
    offset: String(options.offset),
    limit: String(options.limit)
  });

  return requestJson(
    `/api/projects/${projectId}/git/activity?${searchParams.toString()}`,
    "Unable to load Git activity"
  );
}

export function fetchGitFileDiff(
  projectId: string,
  file: { path: string; previousPath: string | null },
  staged: boolean
): Promise<GitFileDiff> {
  const searchParams = new URLSearchParams({
    path: file.path,
    staged: String(staged)
  });
  if (file.previousPath) searchParams.set("previousPath", file.previousPath);

  return requestJson(
    `/api/projects/${projectId}/git/diff?${searchParams.toString()}`,
    "Unable to load file diff"
  );
}

export function runTerminalCommand(projectId: string, command: string): Promise<CommandResult> {
  return requestJson(
    `/api/projects/${projectId}/terminal/run`,
    "Command failed",
    jsonRequest("POST", { command })
  );
}

export function cancelTerminalCommand(projectId: string): Promise<{ ok: true; cancelled: true }> {
  return requestJson(
    `/api/projects/${projectId}/terminal/cancel`,
    "Unable to cancel command",
    { method: "POST" }
  );
}

export function fetchTerminalSuggestions(projectId: string, input: string): Promise<{ suggestions: string[] }> {
  const search = new URLSearchParams({ input });
  return requestJson(
    `/api/projects/${projectId}/terminal/suggestions?${search.toString()}`,
    "Unable to load terminal suggestions"
  );
}
