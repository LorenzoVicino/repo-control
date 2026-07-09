import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ProjectResolver } from "../lib/projectResolver.js";
import { readClaudeSessionDetails, readClaudeSessions, runClaudeMessage } from "../services/claudeService.js";
import type { ClaudePermissionMode } from "../services/claudeService.js";

const projectParamsSchema = z.object({ id: z.string() });
const claudeSessionIdSchema = z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9._:-]+$/);
const claudePermissionModeSchema = z.enum(["default", "plan", "acceptEdits", "auto"]);
const claudeMessageBodySchema = z.object({
  prompt: z.string().trim().min(1).max(8000),
  sessionId: claudeSessionIdSchema.nullish(),
  permissionMode: claudePermissionModeSchema.default("plan")
});

export async function registerClaudeRoutes(app: FastifyInstance, context: ProjectResolver): Promise<void> {
  app.get("/api/projects/:id/claude/sessions", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);

    return readClaudeSessions(projectPath);
  });

  app.get("/api/projects/:id/claude/sessions/:sessionId", async (request) => {
    const params = z.object({ id: z.string(), sessionId: claudeSessionIdSchema }).parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);

    return readClaudeSessionDetails(projectPath, params.sessionId);
  });

  app.post("/api/projects/:id/claude/message", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const body = claudeMessageBodySchema.parse(request.body);
    const projectPath = await context.resolveProjectPath(params.id);

    return runClaudeMessage(projectPath, body.prompt, body.sessionId, body.permissionMode as ClaudePermissionMode);
  });
}
