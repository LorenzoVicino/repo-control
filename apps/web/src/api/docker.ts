import type { CommandResult } from "../types/common";
import type { DockerContainersResponse } from "../types/docker";
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
