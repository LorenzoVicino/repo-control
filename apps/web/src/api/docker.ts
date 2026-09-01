import type { CommandResult } from "../types/common";
import type {
  ContainerSession,
  ContainerSessionRead,
  DockerComposeProjectResponse,
  DockerContainersResponse,
  DockerContainerStatsResponse
} from "../types/docker";
import { jsonRequest, requestJson } from "./http";

export function fetchDockerContainers(): Promise<DockerContainersResponse> {
  return requestJson("/api/docker/containers", "Unable to load Docker containers");
}

export function stopDockerContainers(containerIds: string[]): Promise<CommandResult> {
  return requestJson(
    "/api/docker/containers/stop",
    "Unable to stop Docker containers",
    jsonRequest("POST", { containerIds })
  );
}

export function fetchDockerComposeProject(projectId: string): Promise<DockerComposeProjectResponse> {
  return requestJson(`/api/projects/${projectId}/docker/compose`, "Unable to load Docker Compose project");
}

export function fetchDockerServiceLogs(projectId: string, service: string, tail = 200): Promise<CommandResult> {
  const search = new URLSearchParams({ service, tail: String(tail) });
  return requestJson(
    `/api/projects/${projectId}/docker/logs?${search.toString()}`,
    "Unable to load Docker service logs"
  );
}

export function fetchDockerContainerStats(): Promise<DockerContainerStatsResponse> {
  return requestJson("/api/docker/stats", "Unable to read Docker resource usage");
}

export function openContainerExecSession(
  containerId: string,
  shell?: "bash" | "sh"
): Promise<ContainerSession> {
  return requestJson(
    `/api/docker/containers/${containerId}/exec`,
    "Unable to open a shell in this container",
    jsonRequest("POST", shell ? { shell } : {})
  );
}

export function openContainerLogSession(containerId: string, tail = 300): Promise<ContainerSession> {
  return requestJson(
    `/api/docker/containers/${containerId}/logs`,
    "Unable to follow this container's logs",
    jsonRequest("POST", { tail })
  );
}

export function readContainerSession(sessionId: string, cursor: number): Promise<ContainerSessionRead> {
  return requestJson(
    `/api/docker/sessions/${sessionId}?cursor=${cursor}`,
    "Unable to read the container session"
  );
}

export function sendContainerSessionInput(sessionId: string, data: string): Promise<{ ok: boolean }> {
  return requestJson(
    `/api/docker/sessions/${sessionId}/input`,
    "Unable to send the command to the container",
    jsonRequest("POST", { data })
  );
}

export function closeContainerSession(sessionId: string): Promise<{ ok: boolean }> {
  return requestJson(`/api/docker/sessions/${sessionId}`, "Unable to close the container session", {
    method: "DELETE"
  });
}
