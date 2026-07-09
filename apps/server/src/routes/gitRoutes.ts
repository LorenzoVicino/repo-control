import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CommandRunner } from "../lib/commandRunner.js";
import type { ProjectResolver } from "../lib/projectResolver.js";
import {
  getDirtyCheckoutMessage,
  getGitPathArgs,
  isSafeGitPath,
  isSafeGitRef,
  normalizeRemoteBranch,
  readGitActivity,
  readGitDetails
} from "../services/gitService.js";

type GitRoutesContext = ProjectResolver & {
  runProjectCommand: CommandRunner;
};

const projectParamsSchema = z.object({ id: z.string() });

const gitRefSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(isSafeGitRef, "Invalid branch name");

const gitFilePathSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine(isSafeGitPath, "Invalid Git file path");

const gitFileActionBodySchema = z.object({
  path: gitFilePathSchema,
  previousPath: gitFilePathSchema.nullish()
});

const gitStashRefSchema = z.string().regex(/^stash@\{\d+\}$/, "Invalid stash reference");

export async function registerGitRoutes(app: FastifyInstance, context: GitRoutesContext): Promise<void> {
  app.post("/api/projects/:id/git/fetch", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);

    return context.runProjectCommand(projectPath, "git", ["fetch", "--all", "--prune"]);
  });

  app.get("/api/projects/:id/git/details", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);

    return readGitDetails(projectPath);
  });

  app.get("/api/projects/:id/git/activity", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const query = z
      .object({
        offset: z.coerce.number().int().min(0).max(5000).default(0),
        limit: z.coerce.number().int().min(1).max(30).default(8)
      })
      .parse(request.query);
    const projectPath = await context.resolveProjectPath(params.id);

    return readGitActivity(projectPath, query.offset, query.limit);
  });

  app.post("/api/projects/:id/git/pull", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);

    return context.runProjectCommand(projectPath, "git", ["pull", "--ff-only"]);
  });

  app.post("/api/projects/:id/git/pull-develop", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);

    return context.runProjectCommand(projectPath, "git", ["pull", "origin", "develop"], 1000 * 60 * 5);
  });

  app.post("/api/projects/:id/git/stage-all", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);

    return context.runProjectCommand(projectPath, "git", ["add", "-A"]);
  });

  app.post("/api/projects/:id/git/stage", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const body = gitFileActionBodySchema.parse(request.body);
    const projectPath = await context.resolveProjectPath(params.id);

    return context.runProjectCommand(projectPath, "git", ["add", "-A", ...getGitPathArgs(body.path, body.previousPath)]);
  });

  app.post("/api/projects/:id/git/unstage-all", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);

    return context.runProjectCommand(projectPath, "git", ["reset"]);
  });

  app.post("/api/projects/:id/git/unstage", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const body = gitFileActionBodySchema.parse(request.body);
    const projectPath = await context.resolveProjectPath(params.id);

    return context.runProjectCommand(projectPath, "git", ["reset", ...getGitPathArgs(body.path, body.previousPath)]);
  });

  app.post("/api/projects/:id/git/commit", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const body = z.object({ message: z.string().trim().min(1).max(500) }).parse(request.body);
    const projectPath = await context.resolveProjectPath(params.id);

    return context.runProjectCommand(projectPath, "git", ["commit", "-m", body.message]);
  });

  app.post("/api/projects/:id/git/stash", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const body = z.object({ message: z.string().trim().max(200).optional() }).parse(request.body ?? {});
    const projectPath = await context.resolveProjectPath(params.id);
    const message = body.message || `repo-control stash ${new Date().toISOString()}`;

    return context.runProjectCommand(projectPath, "git", ["stash", "push", "-u", "-m", message]);
  });

  app.post("/api/projects/:id/git/stash-pop", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const body = z.object({ ref: gitStashRefSchema }).parse(request.body);
    const projectPath = await context.resolveProjectPath(params.id);

    return context.runProjectCommand(projectPath, "git", ["stash", "pop", body.ref]);
  });

  app.post("/api/projects/:id/git/push", async (request) => {
    const params = projectParamsSchema.parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);

    return context.runProjectCommand(projectPath, "git", ["push"], 1000 * 60 * 5);
  });

  app.post("/api/projects/:id/git/checkout", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const body = z.object({ branch: gitRefSchema, remote: z.boolean().default(false) }).parse(request.body);
    const projectPath = await context.resolveProjectPath(params.id);
    const dirtyMessage = await getDirtyCheckoutMessage(projectPath);

    if (dirtyMessage) {
      return reply.code(409).send({
        ok: false,
        message: dirtyMessage
      });
    }

    const normalizedBranch = normalizeRemoteBranch(body.branch);
    const args = body.remote ? ["switch", "--track", normalizedBranch] : ["switch", body.branch];

    return context.runProjectCommand(projectPath, "git", args);
  });

  app.post("/api/projects/:id/git/branch", async (request, reply) => {
    const params = projectParamsSchema.parse(request.params);
    const body = z.object({ branch: gitRefSchema }).parse(request.body);
    const projectPath = await context.resolveProjectPath(params.id);
    const dirtyMessage = await getDirtyCheckoutMessage(projectPath);

    if (dirtyMessage) {
      return reply.code(409).send({
        ok: false,
        message: dirtyMessage
      });
    }

    return context.runProjectCommand(projectPath, "git", ["checkout", "-b", body.branch]);
  });
}
