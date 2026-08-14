import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CommandResult } from "../lib/commandRunner.js";
import type { ShellCommandRunnerOptions } from "../lib/commandRunner.js";
import type { ProjectResolver } from "../lib/projectResolver.js";
import { readTerminalSuggestions, rememberTerminalCommand } from "../terminalMemory.js";

type TerminalRoutesContext = ProjectResolver & {
  runShellCommand: (
    cwd: string,
    commandLine: string,
    timeoutMs: number,
    options?: ShellCommandRunnerOptions
  ) => Promise<CommandResult>;
};

const projectParamsSchema = z.object({ id: z.string() });

export async function registerTerminalRoutes(app: FastifyInstance, context: TerminalRoutesContext): Promise<void> {
  const activeCommands = new Map<string, AbortController>();

  app.addHook("onClose", async () => {
    for (const controller of activeCommands.values()) controller.abort();
    activeCommands.clear();
  });

  app.post("/api/projects/:id/terminal/run", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const body = z.object({ command: z.string().trim().min(1).max(2000) }).parse(request.body);
    const projectPath = await context.resolveProjectPath(params.id);
    if (activeCommands.has(projectPath)) {
      return reply.code(409).send({ ok: false, message: "A terminal command is already running for this repository." });
    }

    const controller = new AbortController();
    activeCommands.set(projectPath, controller);

    try {
      const result = await context.runShellCommand(projectPath, body.command, 1000 * 60 * 10, {
        signal: controller.signal
      });
      await rememberTerminalCommand(projectPath, body.command).catch((error) =>
        app.log.warn({ err: error }, "Unable to store terminal command")
      );

      return result;
    } finally {
      if (activeCommands.get(projectPath) === controller) activeCommands.delete(projectPath);
    }
  });

  app.post("/api/projects/:id/terminal/cancel", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);
    const controller = activeCommands.get(projectPath);

    if (!controller) {
      return reply.code(404).send({ ok: false, message: "No terminal command is running for this repository." });
    }

    controller.abort();
    return { ok: true, cancelled: true };
  });

  app.get("/api/projects/:id/terminal/suggestions", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const query = z
      .object({
        input: z.string().trim().max(2000).default("")
      })
      .parse(request.query);
    const projectPath = await context.resolveProjectPath(params.id);

    return readTerminalSuggestions(projectPath, query.input, 3);
  });
}
