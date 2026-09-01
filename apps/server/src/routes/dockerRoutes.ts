import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  findRunningDockerContainer,
  readDockerComposeProject,
  readDockerContainerStats,
  readRunningDockerContainers,
  resolveContainerShell,
  stopDockerContainers
} from "../docker.js";
import type { CommandRunner } from "../lib/commandRunner.js";
import { assertComposeProject } from "../lib/projectResolver.js";
import type { ProjectResolver } from "../lib/projectResolver.js";
import {
  ContainerSessionLimitError,
  createContainerSessionStore
} from "../services/containerSessionService.js";
import type { ContainerSessionStore } from "../services/containerSessionService.js";

type DockerRoutesContext = ProjectResolver & {
  runProjectCommand: CommandRunner;
  // Injectable so the session lifecycle can be exercised without a Docker daemon.
  containerSessions?: ContainerSessionStore;
};

const projectParamsSchema = z.object({ id: z.string() });
const containerParamsSchema = z.object({
  // Hex only, and revalidated against the running containers below: this value reaches a
  // `docker exec` argument list, so a name or a flag must never pass for an ID.
  containerId: z.string().regex(/^[a-f0-9]{12,64}$/i)
});
const sessionParamsSchema = z.object({ sessionId: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/) });
const LOG_TAIL_DEFAULT = 200;

export async function registerDockerRoutes(app: FastifyInstance, context: DockerRoutesContext): Promise<void> {
  const containerSessions = context.containerSessions ?? createContainerSessionStore();

  // Every session holds a live docker client process; none may outlive the server.
  app.addHook("onClose", async () => containerSessions.closeAll());

  app.get("/api/docker/containers", async () =>
    readRunningDockerContainers(context.getActiveRootPath(), context.runProjectCommand)
  );

  app.get("/api/docker/stats", async () =>
    readDockerContainerStats(context.getActiveRootPath(), context.runProjectCommand)
  );

  app.post("/api/docker/containers/:containerId/exec", async (request, reply) => {
    const params = containerParamsSchema.parse(request.params);
    const body = z.object({ shell: z.enum(["bash", "sh"]).optional() }).parse(request.body ?? {});
    const container = await findRunningDockerContainer(
      context.getActiveRootPath(),
      params.containerId,
      context.runProjectCommand
    );

    if (!container) {
      return reply.code(404).send({
        ok: false,
        code: "CONTAINER_NOT_RUNNING",
        message: "That container is not among the running containers."
      });
    }

    const shell =
      body.shell ??
      (await resolveContainerShell(context.getActiveRootPath(), container.id, context.runProjectCommand));

    if (!shell) {
      return reply.code(422).send({
        ok: false,
        code: "NO_CONTAINER_SHELL",
        message: "This container has no usable shell, so an exec session cannot be opened."
      });
    }

    try {
      // -i without -t: the server has no terminal to allocate, so the shell reads a pipe.
      // Enough for commands and their output, not for full-screen programs.
      return containerSessions.open({
        kind: "exec",
        containerId: container.id,
        containerName: container.name,
        dockerArgs: ["exec", "-i", container.id, shell],
        shell,
        acceptsInput: true
      });
    } catch (error) {
      return replyForSessionError(reply, error);
    }
  });

  app.post("/api/docker/containers/:containerId/logs", async (request, reply) => {
    const params = containerParamsSchema.parse(request.params);
    const body = z
      .object({ tail: z.coerce.number().int().min(20).max(2000).default(LOG_TAIL_DEFAULT) })
      .parse(request.body ?? {});
    const container = await findRunningDockerContainer(
      context.getActiveRootPath(),
      params.containerId,
      context.runProjectCommand
    );

    if (!container) {
      return reply.code(404).send({
        ok: false,
        code: "CONTAINER_NOT_RUNNING",
        message: "That container is not among the running containers."
      });
    }

    try {
      return containerSessions.open({
        kind: "logs",
        containerId: container.id,
        containerName: container.name,
        dockerArgs: ["logs", "--follow", "--tail", String(body.tail), container.id],
        acceptsInput: false
      });
    } catch (error) {
      return replyForSessionError(reply, error);
    }
  });

  app.get("/api/docker/sessions/:sessionId", async (request, reply) => {
    const params = sessionParamsSchema.parse(request.params);
    const query = z.object({ cursor: z.coerce.number().int().min(0).default(0) }).parse(request.query);
    const session = containerSessions.read(params.sessionId, query.cursor);

    if (!session) {
      return reply.code(404).send({
        ok: false,
        code: "SESSION_NOT_FOUND",
        message: "That session has been closed."
      });
    }

    return session;
  });

  app.post("/api/docker/sessions/:sessionId/input", async (request, reply) => {
    const params = sessionParamsSchema.parse(request.params);
    const body = z.object({ data: z.string().max(4000) }).parse(request.body);

    if (!containerSessions.write(params.sessionId, body.data)) {
      return reply.code(409).send({
        ok: false,
        code: "SESSION_NOT_WRITABLE",
        message: "That session is closed or does not accept input."
      });
    }

    return { ok: true };
  });

  app.delete("/api/docker/sessions/:sessionId", async (request, reply) => {
    const params = sessionParamsSchema.parse(request.params);

    if (!containerSessions.close(params.sessionId)) {
      return reply.code(404).send({
        ok: false,
        code: "SESSION_NOT_FOUND",
        message: "That session has already been closed."
      });
    }

    return { ok: true };
  });

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

function replyForSessionError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof ContainerSessionLimitError) {
    return reply.code(429).send({ ok: false, code: error.code, message: error.message });
  }

  throw error;
}
