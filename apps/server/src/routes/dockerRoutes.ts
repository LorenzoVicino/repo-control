import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { readDockerComposeProject, readRunningDockerContainers, stopDockerContainers } from "../docker.js";
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

  app.get("/api/projects/:id/docker/compose", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);

    await assertComposeProject(projectPath);
    return readDockerComposeProject(projectPath, context.runProjectCommand);
  });

  app.get("/api/projects/:id/docker/logs", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const query = z.object({
      service: z.string().regex(/^[A-Za-z0-9._-]+$/).max(160),
      tail: z.coerce.number().int().min(20).max(1000).default(200)
    }).parse(request.query);
    const projectPath = await context.resolveProjectPath(params.id);

    await assertComposeProject(projectPath);
    return context.runProjectCommand(
      projectPath,
      "docker",
      ["compose", "logs", "--no-color", `--tail=${query.tail}`, query.service],
      1000 * 60
    );
  });

  app.post("/api/projects/:id/docker/restart-service", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const body = z.object({ service: z.string().regex(/^[A-Za-z0-9._-]+$/).max(160) }).parse(request.body);
    const projectPath = await context.resolveProjectPath(params.id);

    await assertComposeProject(projectPath);
    return context.runProjectCommand(projectPath, "docker", ["compose", "restart", body.service], 1000 * 60 * 5);
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
