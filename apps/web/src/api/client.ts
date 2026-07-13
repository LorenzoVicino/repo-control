import type {
  AppUpdateResult,
  AppUpdateStatus,
  BrainContentPhase,
  BrainContextPreview,
  BrainGatePhase,
  BrainTask,
  BrainTaskRun,
  BrainTasksResponse,
  BrainTaskType,
  CommandResult,
  DockerContainersResponse,
  GitActivity,
  GitDetails,
  ProjectsResponse,
  UserPreferences
} from "../types";

async function readApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? fallbackMessage);
  }

  return payload as T;
}

export async function fetchBrainTasks(projectId: string): Promise<BrainTasksResponse> {
  return readApiResponse(await fetch(`/api/projects/${projectId}/tasks`), "Unable to load tasks");
}

export async function createBrainTask(
  projectId: string,
  input: { title: string; type: BrainTaskType; description: string; motivation: string }
): Promise<BrainTask> {
  return readApiResponse(
    await fetch(`/api/projects/${projectId}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    }),
    "Unable to create task"
  );
}

export async function updateBrainTask(
  projectId: string,
  taskId: string,
  input: {
    title?: string;
    type?: BrainTaskType;
    definition?: { description?: string; motivation?: string };
    phase?: BrainContentPhase;
    content?: string;
  }
): Promise<BrainTask> {
  return readApiResponse(
    await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    }),
    "Unable to save task"
  );
}

export async function approveBrainTask(
  projectId: string,
  taskId: string,
  phase: BrainGatePhase
): Promise<BrainTask> {
  return readApiResponse(
    await fetch(`/api/projects/${projectId}/tasks/${taskId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase })
    }),
    "Unable to approve task phase"
  );
}

export async function fetchBrainContext(projectId: string, taskId: string): Promise<BrainContextPreview> {
  return readApiResponse(
    await fetch(`/api/projects/${projectId}/tasks/${taskId}/context`),
    "Unable to assemble brain context"
  );
}

export async function runBrainTask(
  projectId: string,
  taskId: string,
  input: { prompt: string; checks: string[] }
): Promise<BrainTaskRun> {
  return readApiResponse(
    await fetch(`/api/projects/${projectId}/tasks/${taskId}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    }),
    "Engineering run failed"
  );
}

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

export async function fetchGitActivity(
  projectId: string,
  options: { offset: number; limit: number }
): Promise<GitActivity> {
  const searchParams = new URLSearchParams({
    offset: String(options.offset),
    limit: String(options.limit)
  });
  const response = await fetch(`/api/projects/${projectId}/git/activity?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error("Unable to load Git activity");
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

export async function fetchPreferences(): Promise<UserPreferences> {
  const response = await fetch("/api/preferences");
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? "Unable to load local preferences");
  }

  return payload as UserPreferences;
}

export async function updatePreferences(preferences: UserPreferences): Promise<UserPreferences> {
  const response = await fetch("/api/preferences", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(preferences)
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? "Unable to save local preferences");
  }

  return payload as UserPreferences;
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

export async function fetchAppUpdateStatus(): Promise<AppUpdateStatus> {
  const response = await fetch("/api/app/update-status");
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? "Unable to check repo-control updates");
  }

  return payload as AppUpdateStatus;
}

export async function fetchProjects(): Promise<ProjectsResponse> {
  const response = await fetch("/api/projects");

  if (!response.ok) {
    throw new Error("Unable to load projects");
  }

  return response.json();
}

export async function fetchDockerContainers(): Promise<DockerContainersResponse> {
  const response = await fetch("/api/docker/containers");
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? "Unable to load Docker containers");
  }

  return payload as DockerContainersResponse;
}

export async function stopDockerContainers(containerIds: string[]): Promise<CommandResult> {
  const response = await fetch("/api/docker/containers/stop", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ containerIds })
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message ?? "Unable to stop Docker containers");
  }

  return payload as CommandResult;
}
