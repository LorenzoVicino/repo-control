import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CommandResult, CommandRunner } from "../lib/commandRunner.js";
import type { ProjectResolver } from "../lib/projectResolver.js";
import {
  createWorkflow,
  deleteWorkflow,
  executeWorkflow,
  readWorkflowRuns,
  readWorkflows,
  updateWorkflow
} from "../services/workflowService.js";

type WorkflowRoutesContext = Pick<ProjectResolver, "getActiveRootPath"> & {
  runProjectCommand: CommandRunner;
  runShellCommand: (cwd: string, commandLine: string, timeoutMs: number) => Promise<CommandResult>;
};

const workflowParamsSchema = z.object({ id: z.string().trim().min(1).max(160) });
const workflowBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).default(""),
  active: z.boolean().default(false),
  nodes: z.array(z.unknown()).min(1).max(80),
  edges: z.array(z.unknown()).max(120)
});

export async function registerWorkflowRoutes(app: FastifyInstance, context: WorkflowRoutesContext): Promise<void> {
  app.get("/api/workflows", async () => readWorkflows());

  app.post("/api/workflows", async (request) => {
    const body = workflowBodySchema.parse(request.body);

    return createWorkflow(body);
  });

  app.put("/api/workflows/:id", async (request, reply) => {
    const params = workflowParamsSchema.parse(request.params);
    const body = workflowBodySchema.parse(request.body);
    const workflow = await updateWorkflow(params.id, body);

    if (!workflow) {
      return reply.code(404).send({
        ok: false,
        message: "Workflow not found"
      });
    }

    return workflow;
  });

  app.delete("/api/workflows/:id", async (request, reply) => {
    const params = workflowParamsSchema.parse(request.params);
    const deleted = await deleteWorkflow(params.id);

    if (!deleted) {
      return reply.code(404).send({
        ok: false,
        message: "Workflow not found"
      });
    }

    return {
      ok: true
    };
  });

  app.post("/api/workflows/:id/dry-run", async (request, reply) => {
    const params = workflowParamsSchema.parse(request.params);
    const run = await executeWorkflow(params.id, "dry-run", context);

    if (!run) {
      return reply.code(404).send({
        ok: false,
        message: "Workflow not found"
      });
    }

    return run;
  });

  app.post("/api/workflows/:id/run", async (request, reply) => {
    const params = workflowParamsSchema.parse(request.params);
    const run = await executeWorkflow(params.id, "run", context);

    if (!run) {
      return reply.code(404).send({
        ok: false,
        message: "Workflow not found"
      });
    }

    return run;
  });

  app.get("/api/workflows/:id/runs", async (request) => {
    const params = workflowParamsSchema.parse(request.params);

    return readWorkflowRuns(params.id);
  });

  app.get("/api/workflow-runs", async () => readWorkflowRuns());
}
