import path from "node:path";
import { z } from "zod";
import { readDockerComposeProject, readRunningDockerContainers, type DockerComposeService } from "../../docker.js";
import { assertComposeProject } from "../../lib/projectResolver.js";
import { commandOutput, count, relativePath, tail } from "./format.js";
import { repositoryInput } from "./repositoryTools.js";
import { defineTool, ToolError, type ResolvedRepository, type ToolRuntime } from "./types.js";

// Compose service names reach `docker compose` as arguments. A leading letter or digit
// keeps them from ever being read as an option.
const serviceInput = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/, "Invalid Compose service name")
  .describe("Compose service name, as listed by compose_status.");

async function resolveComposeRepository(runtime: ToolRuntime, reference: string): Promise<ResolvedRepository> {
  const resolved = await runtime.resolveRepository(reference);
  try {
    await assertComposeProject(resolved.path);
  } catch {
    throw new ToolError(`${resolved.project.name} has no Docker Compose file (compose.yml or docker-compose.yml).`);
  }
  return resolved;
}

function describeService(service: DockerComposeService): string {
  const ports = service.ports
    .map((port) => port.url ?? (port.published ? `${port.published}→${port.target}` : String(port.target)))
    .join(", ");
  return (
    `- ${service.name}: ${service.state}${service.status && service.status !== service.state ? ` (${service.status})` : ""}` +
    `${service.health ? `, ${service.health}` : ""}${ports ? `, ports ${ports}` : ""}`
  );
}

export const composeStatus = defineTool({
  name: "compose_status",
  title: "Docker Compose status",
  description: "List the Docker Compose services of a repository with their state, health and published ports, including stopped ones.",
  effect: "read",
  inputShape: { repository: repositoryInput },
  async run(runtime, input) {
    const { project, path } = await resolveComposeRepository(runtime, input.repository);
    const compose = await readDockerComposeProject(path, runtime.runProjectCommand);
    if (!compose.ok) throw new ToolError(`Could not read the Compose project of ${project.name}: ${compose.error ?? "unknown error"}`);
    return {
      text: `${project.name}, Compose project ${compose.name}:\n${compose.services.map(describeService).join("\n") || "no services defined"}`,
      data: { name: compose.name, services: compose.services }
    };
  }
});

export const composeLogs = defineTool({
  name: "compose_logs",
  title: "Docker Compose logs",
  description: "Read the most recent log lines of one Compose service. Use it to explain why a service is unhealthy or exited.",
  effect: "read",
  inputShape: {
    repository: repositoryInput,
    service: serviceInput,
    tail: z.number().int().min(10).max(500).default(100).describe("How many of the latest lines to read.")
  },
  async run(runtime, input) {
    const { project, path } = await resolveComposeRepository(runtime, input.repository);
    const result = await runtime.runProjectCommand(
      path,
      "docker",
      ["compose", "logs", "--no-color", `--tail=${input.tail}`, input.service],
      60_000
    );
    if (!result.ok) return commandOutput(`docker compose logs ${input.service}`, project.name, result);
    const logs = tail(result.stdout.trim(), 8_000);
    return {
      text: `${project.name}, last ${input.tail} lines of ${input.service}:\n${logs || "(no output)"}`,
      data: { service: input.service, logs }
    };
  }
});

export const composeUp = defineTool({
  name: "compose_up",
  title: "Start Compose services",
  description: "Start all Compose services of a repository in the background (docker compose up -d). Set build to rebuild images first.",
  effect: "write",
  inputShape: {
    repository: repositoryInput,
    build: z.boolean().default(false).describe("Rebuild the images before starting (docker compose up -d --build).")
  },
  async run(runtime, input) {
    const { project, path } = await resolveComposeRepository(runtime, input.repository);
    const args = ["compose", "up", "-d", ...(input.build ? ["--build"] : [])];
    return commandOutput(`docker ${args.join(" ")}`, project.name, await runtime.runProjectCommand(path, "docker", args, 10 * 60_000));
  }
});

export const composeStop = defineTool({
  name: "compose_stop",
  title: "Stop Compose services",
  description: "Stop all running Compose services of a repository (docker compose stop). Containers and volumes are kept.",
  effect: "write",
  inputShape: { repository: repositoryInput },
  async run(runtime, input) {
    const { project, path } = await resolveComposeRepository(runtime, input.repository);
    return commandOutput("docker compose stop", project.name, await runtime.runProjectCommand(path, "docker", ["compose", "stop"], 5 * 60_000));
  }
});

export const composeRestartService = defineTool({
  name: "compose_restart_service",
  title: "Restart a Compose service",
  description: "Restart one Compose service of a repository (docker compose restart <service>), for example after changing its configuration.",
  effect: "write",
  inputShape: { repository: repositoryInput, service: serviceInput },
  async run(runtime, input) {
    const { project, path } = await resolveComposeRepository(runtime, input.repository);
    return commandOutput(
      `docker compose restart ${input.service}`,
      project.name,
      await runtime.runProjectCommand(path, "docker", ["compose", "restart", input.service], 5 * 60_000)
    );
  }
});

export const listContainers = defineTool({
  name: "list_containers",
  title: "List running containers",
  description: "List every running Docker container on this machine, grouped by Compose project, with image, status and ports.",
  effect: "read",
  inputShape: {},
  async run(runtime) {
    const rootPath = runtime.rootPath();
    const running = await readRunningDockerContainers(rootPath, runtime.runProjectCommand);
    if (!running.ok) throw new ToolError(`Docker is not available: ${running.error ?? "unknown error"}`);
    const lines = running.groups.map((group) => {
      const where = group.workingDir ? relativePath(rootPath, group.workingDir) : null;
      // Containers started from outside the workspace keep their location to themselves.
      const location = where && !where.startsWith("..") && !path.isAbsolute(where) ? ` (${where})` : "";
      const containers = group.containers.map((container) => `  - ${container.composeService ?? container.name}: ${container.image}, ${container.status}${container.ports ? `, ${container.ports}` : ""}`);
      return `${group.name}${location}:\n${containers.join("\n")}`;
    });
    return {
      text: running.containers.length ? `${count(running.containers.length, "running container")}.\n${lines.join("\n")}` : "No containers are running.",
      data: {
        groups: running.groups.map((group) => ({
          name: group.name,
          composeProject: group.composeProject,
          containers: group.containers.map(({ id, name, image, status, ports, composeService }) => ({ id, name, image, status, ports, composeService }))
        }))
      }
    };
  }
});

export const dockerTools = [listContainers, composeStatus, composeLogs, composeUp, composeStop, composeRestartService];
