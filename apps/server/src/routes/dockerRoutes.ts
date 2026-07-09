import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { readRunningDockerContainers, stopDockerContainers } from "../docker.js";
import type { CommandRunner } from "../lib/commandRunner.js";
import { assertComposeProject } from "../lib/projectResolver.js";
import type { ProjectResolver } from "../lib/projectResolver.js";

type DockerRoutesContext = ProjectResolver & {
  runProjectCommand: CommandRunner;
};

const projectParamsSchema = z.object({ id: z.string() });

export async function registerDockerRoutes(app: FastifyInstance, context: DockerRoutesContext): Promise<void> {
  app.get("/api/docker/containers", async () =>
    readRunningDockerContainers(context.getActiveRootPath(), context.runProjectCommand)
  );

  app.post("/api/docker/containers/stop", async (request) => {
    const body = z
      .object({
        containerIds: z.array(z.string().regex(/^[a-f0-9]{12,64}$/i)).min(1).max(100)
      })
      .parse(request.body);

    return stopDockerContainers(context.getActiveRootPath(), body.containerIds, context.runProjectCommand);
  });

  app.post("/api/projects/:id/docker/rebuild", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);

    await assertComposeProject(projectPath);
    return context.runProjectCommand(projectPath, "docker", ["compose", "up", "-d", "--build"], 1000 * 60 * 10);
  });

  app.post("/api/projects/:id/docker/up", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);

    await assertComposeProject(projectPath);
    return context.runProjectCommand(projectPath, "docker", ["compose", "up", "-d"], 1000 * 60 * 10);
  });

  app.post("/api/projects/:id/docker/stop", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);

    await assertComposeProject(projectPath);
    return context.runProjectCommand(projectPath, "docker", ["compose", "stop"], 1000 * 60 * 5);
  });
}
