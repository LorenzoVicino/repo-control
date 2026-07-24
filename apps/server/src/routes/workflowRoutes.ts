import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { CommandRunner, ShellCommandRunner } from "../lib/commandRunner.js";
import type { ProjectResolver } from "../lib/projectResolver.js";
import { WorkflowInputValidationError } from "../services/workflow/input.js";
import { WorkflowDefinitionValidationError } from "../services/workflow/validation.js";
import type { WorkflowRunMode } from "../services/workflow/types.js";
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
  runShellCommand: ShellCommandRunner;
};

const workflowParamsSchema = z.object({ id: z.string().trim().min(1).max(160) });
const workflowBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).default(""),
  active: z.boolean().default(false),
  nodes: z.array(z.unknown()).min(1).max(80),
  edges: z.array(z.unknown()).max(120)
});
const workflowInputsSchema = z.record(z.string().max(4000)).superRefine((inputs, context) => {
  if (Object.keys(inputs).length > 20) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A workflow run can provide at most 20 inputs"
    });
  }

  for (const key of Object.keys(inputs)) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(key)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `Invalid workflow input key "${key}"`
      });
    }
  }
});
const workflowExecutionBodySchema = z.object({
  inputs: workflowInputsSchema.default({})
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
    return executeWorkflowRequest(params.id, "dry-run", request.body, context, reply);
  });

  app.post("/api/workflows/:id/run", async (request, reply) => {
    const params = workflowParamsSchema.parse(request.params);
    return executeWorkflowRequest(params.id, "run", request.body, context, reply);
  });

  app.get("/api/workflows/:id/runs", async (request) => {
    const params = workflowParamsSchema.parse(request.params);

    return readWorkflowRuns(params.id);
  });

  app.get("/api/workflow-runs", async () => readWorkflowRuns());
}

async function executeWorkflowRequest(
  workflowId: string,
  mode: WorkflowRunMode,
  body: unknown,
  context: WorkflowRoutesContext,
  reply: FastifyReply
) {
  const parsedBody = workflowExecutionBodySchema.safeParse(body ?? {});

  if (!parsedBody.success) {
    return reply.code(400).send({
      ok: false,
      message: parsedBody.error.issues[0]?.message ?? "Invalid workflow inputs"
    });
  }

  let run;

  try {
    run = await executeWorkflow(workflowId, mode, context, parsedBody.data.inputs);
  } catch (error) {
    if (
      error instanceof WorkflowInputValidationError
      || error instanceof WorkflowDefinitionValidationError
    ) {
      return reply.code(400).send({ ok: false, message: error.message });
    }

    throw error;
  }

  if (!run) {
    return reply.code(404).send({
      ok: false,
      message: "Workflow not found"
    });
  }

  return run;
}
