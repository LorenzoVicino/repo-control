import path from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ProjectResolver } from "../lib/projectResolver.js";
import type { CommandResult } from "../lib/commandRunner.js";
import {
  BrainValidationError,
  appendBrainTaskDecision,
  appendBrainTaskLog,
  assembleBrainContext,
  approveBrainTaskPhase,
  createBrainTask,
  deleteBrainTask,
  readBrainTask,
  readBrainTasks,
  updateBrainTask,
  getBrainTaskSpecHash
} from "../services/brainService.js";
import { executeEngineeringRun } from "../services/engineeringRunService.js";

const projectParamsSchema = z.object({ id: z.string() });
const taskParamsSchema = z.object({
  id: z.string(),
  taskId: z.string().trim().min(1).max(160)
});
const taskTypeSchema = z.enum(["feature", "fix", "refactor", "chore", "spike"]);
const contentPhaseSchema = z.enum(["requirements", "design", "breakdown"]);
const gatePhaseSchema = z.enum(["definition", "requirements", "design", "breakdown", "implementation"]);
const contextProjectIdsSchema = z
  .array(z.string().trim().min(1).max(2048))
  .max(12)
  .transform((projectIds) => [...new Set(projectIds)]);

const createTaskBodySchema = z.object({
  title: z.string().trim().min(1).max(160),
  type: taskTypeSchema.default("feature"),
  description: z.string().max(20_000).default(""),
  motivation: z.string().max(20_000).default(""),
  contextProjectIds: contextProjectIdsSchema.default([])
});

const updateTaskBodySchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    type: taskTypeSchema.optional(),
    contextProjectIds: contextProjectIdsSchema.optional(),
    definition: z
      .object({
        description: z.string().max(20_000).optional(),
        motivation: z.string().max(20_000).optional()
      })
      .optional(),
    phase: contentPhaseSchema.optional(),
    content: z.string().max(120_000).optional(),
    git: z
      .object({
        branch: z.string().max(255).nullable().optional(),
        prUrl: z.string().max(2000).nullable().optional()
      })
      .optional(),
    claudeSessionId: z.string().trim().min(1).max(160).nullable().optional()
  })
  .superRefine((value, context) => {
    if (value.phase && value.content === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["content"],
        message: "Content is required when phase is provided"
      });
    }
  });

const approveTaskBodySchema = z.object({
  phase: gatePhaseSchema
});

const appendLogBodySchema = z.object({
  kind: z.enum(["note", "fix", "result"]).default("note"),
  content: z.string().trim().min(1).max(20_000)
});

const appendDecisionBodySchema = z.object({
  title: z.string().trim().min(1).max(160),
  rationale: z.string().trim().min(1).max(20_000)
});

const runTaskBodySchema = z.object({
  prompt: z.string().max(20_000).default(""),
  checks: z.array(z.string().trim().min(1).max(1000)).min(1).max(12)
});

type BrainRoutesContext = ProjectResolver & {
  runShellCommand: (cwd: string, commandLine: string, timeoutMs: number) => Promise<CommandResult>;
};

export async function registerBrainRoutes(app: FastifyInstance, context: BrainRoutesContext): Promise<void> {
  app.get("/api/projects/:id/tasks", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);

    return readBrainTasks(projectPath);
  });

  app.get("/api/projects/:id/tasks/:taskId", async (request, reply) => {
    const params = taskParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);
    const task = await readBrainTask(projectPath, params.taskId);

    if (!task) {
      return sendTaskNotFound(reply);
    }

    return task;
  });

  app.get("/api/projects/:id/tasks/:taskId/context", async (request, reply) => {
    const params = taskParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);
    const task = await readBrainTask(projectPath, params.taskId);

    if (!task) {
      return sendTaskNotFound(reply);
    }

    return {
      content: await assembleBrainContext(projectPath, task),
      specHash: getBrainTaskSpecHash(task),
      generatedAt: new Date().toISOString()
    };
  });

  app.post("/api/projects/:id/tasks", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const body = createTaskBodySchema.parse(request.body);
    const projectPath = await context.resolveProjectPath(params.id);
    const contextRepositoryPaths = await resolveContextRepositoryPaths(
      context,
      body.contextProjectIds,
      projectPath
    );

    return createBrainTask(projectPath, {
      title: body.title,
      type: body.type,
      contextRepositoryPaths,
      definition: {
        description: body.description,
        motivation: body.motivation
      }
    });
  });

  app.put("/api/projects/:id/tasks/:taskId", async (request, reply) => {
    const params = taskParamsSchema.parse(request.params);
    const body = updateTaskBodySchema.parse(request.body);
    const projectPath = await context.resolveProjectPath(params.id);
    const { contextProjectIds, ...taskInput } = body;
    const contextRepositoryPaths = contextProjectIds
      ? await resolveContextRepositoryPaths(context, contextProjectIds, projectPath)
      : undefined;

    return sendBrainMutation(reply, () =>
      updateBrainTask(projectPath, params.taskId, {
        ...taskInput,
        ...(contextRepositoryPaths ? { contextRepositoryPaths } : {})
      })
    );
  });

  app.post("/api/projects/:id/tasks/:taskId/approve", async (request, reply) => {
    const params = taskParamsSchema.parse(request.params);
    const body = approveTaskBodySchema.parse(request.body);
    const projectPath = await context.resolveProjectPath(params.id);

    return sendBrainMutation(reply, () => approveBrainTaskPhase(projectPath, params.taskId, body.phase));
  });

  app.post("/api/projects/:id/tasks/:taskId/log", async (request, reply) => {
    const params = taskParamsSchema.parse(request.params);
    const body = appendLogBodySchema.parse(request.body);
    const projectPath = await context.resolveProjectPath(params.id);

    return sendBrainMutation(reply, () => appendBrainTaskLog(projectPath, params.taskId, body));
  });

  app.post("/api/projects/:id/tasks/:taskId/decision", async (request, reply) => {
    const params = taskParamsSchema.parse(request.params);
    const body = appendDecisionBodySchema.parse(request.body);
    const projectPath = await context.resolveProjectPath(params.id);

    return sendBrainMutation(reply, () => appendBrainTaskDecision(projectPath, params.taskId, body));
  });

  app.post("/api/projects/:id/tasks/:taskId/runs", async (request, reply) => {
    const params = taskParamsSchema.parse(request.params);
    const body = runTaskBodySchema.parse(request.body);
    const projectPath = await context.resolveProjectPath(params.id);

    return sendBrainMutation(reply, () => executeEngineeringRun(projectPath, params.taskId, body, context));
  });

  app.delete("/api/projects/:id/tasks/:taskId", async (request, reply) => {
    const params = taskParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);
    const deleted = await deleteBrainTask(projectPath, params.taskId);

    if (!deleted) {
      return sendTaskNotFound(reply);
    }

    return {
      ok: true
    };
  });
}

async function resolveContextRepositoryPaths(
  context: ProjectResolver,
  projectIds: string[],
  primaryProjectPath: string
): Promise<string[]> {
  const primaryPath = path.resolve(primaryProjectPath);
  const repositoryPaths = await Promise.all(projectIds.map((projectId) => context.resolveProjectPath(projectId)));

  return [...new Set(repositoryPaths.map((repositoryPath) => path.resolve(repositoryPath)))].filter(
    (repositoryPath) => repositoryPath !== primaryPath
  );
}

async function sendBrainMutation<T>(
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
  action: () => Promise<T | null>
): Promise<T | unknown> {
  try {
    const result = await action();

    if (!result) {
      return sendTaskNotFound(reply);
    }

    return result;
  } catch (error) {
    if (error instanceof BrainValidationError) {
      return reply.code(error.statusCode).send({
        ok: false,
        message: error.message
      });
    }

    throw error;
  }
}

function sendTaskNotFound(reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }): unknown {
  return reply.code(404).send({
    ok: false,
    message: "Task not found"
  });
}
