import type { FastifyInstance } from "fastify";
import path from "node:path";
import { z } from "zod";
import { scanProjects } from "../gitScanner.js";
import type { ProjectSummary } from "../gitScanner.js";
import type { ProjectResolver } from "../lib/projectResolver.js";
import {
  findAgentSession,
  getAgentResumeSpec,
  scanAgentSessions
} from "../services/agentSessionService.js";
import type { AgentSessionProvider } from "../services/agentSessionService.js";
import { openAgentSessionInNativeTerminal } from "../services/nativeTerminalService.js";
import type { NativeTerminalLauncher } from "../services/nativeTerminalService.js";

type AgentSessionRoutesContext = ProjectResolver & {
  openNativeTerminal?: NativeTerminalLauncher;
  scanProjects?: (rootPath: string) => Promise<ProjectSummary[]>;
  scanAgentSessions?: typeof scanAgentSessions;
};

const resumeParamsSchema = z.object({
  provider: z.enum(["claude", "codex", "gemini"]),
  sessionId: z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9._:-]+$/)
});
const resumeBodySchema = z.object({
  projectId: z.string().trim().min(1).max(2048)
});
const listQuerySchema = z.object({
  search: z.string().trim().max(200).default("")
});

export async function registerAgentSessionRoutes(
  app: FastifyInstance,
  context: AgentSessionRoutesContext
): Promise<void> {
  app.get("/api/agent-sessions", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const rootPath = context.getActiveRootPath();
    const projects = await (context.scanProjects ?? scanProjects)(rootPath);
    return (context.scanAgentSessions ?? scanAgentSessions)(rootPath, projects, {
      searchTerm: query.search
    });
  });

  app.post("/api/agent-sessions/:provider/:sessionId/resume", async (request, reply) => {
    const params = resumeParamsSchema.parse(request.params);
    const body = resumeBodySchema.parse(request.body);
    const projectPath = await context.resolveProjectPath(body.projectId);
    const rootPath = context.getActiveRootPath();
    const projects = await (context.scanProjects ?? scanProjects)(rootPath);
    const sessionData = await (context.scanAgentSessions ?? scanAgentSessions)(rootPath, projects);
    const session = findAgentSession(
      sessionData,
      params.provider as AgentSessionProvider,
      params.sessionId,
      body.projectId
    );

    if (!session || path.resolve(session.projectPath) !== path.resolve(projectPath)) {
      return reply.code(404).send({
        ok: false,
        message: "Session not found for this repository"
      });
    }

    const agent = sessionData.agents.find((item) => item.id === params.provider);

    if (!agent?.installed) {
      return reply.code(409).send({
        ok: false,
        message: `${session.providerLabel} is not available in the server PATH`,
        command: getAgentResumeSpec(params.provider as AgentSessionProvider, params.sessionId).displayCommand
      });
    }

    const resumeSpec = getAgentResumeSpec(params.provider as AgentSessionProvider, params.sessionId);
    const openTerminal = context.openNativeTerminal ?? openAgentSessionInNativeTerminal;
    const result = await openTerminal(projectPath, resumeSpec);

    return reply.code(result.ok ? 200 : 501).send(result);
  });
}
