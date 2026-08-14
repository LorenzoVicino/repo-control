import type { CommandResult } from "../types/common";
import type { DockerComposeProjectResponse, DockerContainersResponse } from "../types/docker";
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
