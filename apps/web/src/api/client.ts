import type { AppUpdateResult, CommandResult, GitDetails, ProjectsResponse } from "../types";

export async function runProjectAction(
  projectId: string,
  actionPath: string,
  label: string,
  body?: unknown
): Promise<CommandResult> {
  const response = await fetch(`/api/projects/${projectId}/${actionPath}`, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? payload?.error ?? "Action failed");
  }

  if (payload && "command" in payload) {
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

export async function fetchGitDetails(projectId: string): Promise<GitDetails> {
  const response = await fetch(`/api/projects/${projectId}/git/details`);

  if (!response.ok) {
    throw new Error("Unable to load Git details");
  }

  return response.json();
}

export async function runTerminalCommand(projectId: string, command: string): Promise<CommandResult> {
  const response = await fetch(`/api/projects/${projectId}/terminal/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ command })
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? "Command failed");
  }

  return payload as CommandResult;
}

export async function setRootPath(root: string): Promise<{ root: string }> {
  const response = await fetch("/api/root", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ root })
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? "Unable to change folder");
  }

  return { root: payload.root };
}

export async function pickWorkspaceFolder(initialPath: string): Promise<string | null> {
  const response = await fetch("/api/folder-picker", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ initialPath })
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? "Unable to pick folder");
  }

  if (payload?.cancelled) {
    return null;
  }

  if (typeof payload?.path === "string") {
    return payload.path;
  }

  throw new Error("Folder picker returned no path");
}

export async function updateRepoControl(): Promise<AppUpdateResult> {
  const response = await fetch("/api/app/update", {
    method: "POST"
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? "Unable to update repo-control");
  }

  return payload as AppUpdateResult;
}

export async function fetchProjects(): Promise<ProjectsResponse> {
  const response = await fetch("/api/projects");

  if (!response.ok) {
    throw new Error("Unable to load projects");
  }

  return response.json();
}
