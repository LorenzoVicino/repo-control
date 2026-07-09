import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CommandResult } from "../lib/commandRunner.js";
import type { ProjectResolver } from "../lib/projectResolver.js";
import { readTerminalSuggestions, rememberTerminalCommand } from "../terminalMemory.js";

type TerminalRoutesContext = ProjectResolver & {
  runShellCommand: (cwd: string, commandLine: string, timeoutMs: number) => Promise<CommandResult>;
};

const projectParamsSchema = z.object({ id: z.string() });

export async function registerTerminalRoutes(app: FastifyInstance, context: TerminalRoutesContext): Promise<void> {
  app.post("/api/projects/:id/terminal/run", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const body = z.object({ command: z.string().trim().min(1).max(2000) }).parse(request.body);
    const projectPath = await context.resolveProjectPath(params.id);

    const result = await context.runShellCommand(projectPath, body.command, 1000 * 60 * 10);
    await rememberTerminalCommand(projectPath, body.command).catch((error) =>
      app.log.warn({ err: error }, "Unable to store terminal command")
    );

    return result;
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
