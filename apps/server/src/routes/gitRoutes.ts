import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { CommandRunner } from "../lib/commandRunner.js";
import type { ProjectResolver } from "../lib/projectResolver.js";
import {
  commitMessageSchema,
  createGitActions,
  gitFilePathSchema,
  gitRefSchema,
  gitStashRefSchema,
  stashMessageSchema,
  type GuardedGitResult
} from "../services/gitActions.js";
import { readGitActivity, readGitDetails, readGitFileDiff } from "../services/gitService.js";

type GitRoutesContext = ProjectResolver & {
  runProjectCommand: CommandRunner;
};

const projectParamsSchema = z.object({ id: z.string() });

const gitFileActionBodySchema = z.object({
  path: gitFilePathSchema,
  previousPath: gitFilePathSchema.nullish()
});

function sendGuarded(reply: FastifyReply, outcome: GuardedGitResult) {
  if (outcome.status === "blocked") {
    return reply.code(409).send({ ok: false, message: outcome.message });
  }

  return outcome.result;
}

export async function registerGitRoutes(app: FastifyInstance, context: GitRoutesContext): Promise<void> {
  const actions = createGitActions({ run: context.runProjectCommand });

  const projectPathFor = (params: unknown) => context.resolveProjectPath(projectParamsSchema.parse(params).id);

  app.post("/api/projects/:id/git/fetch", async (request) => actions.fetch(await projectPathFor(request.params)));

  app.get("/api/projects/:id/git/details", async (request) => readGitDetails(await projectPathFor(request.params)));

  app.get("/api/projects/:id/git/activity", async (request) => {
    const query = z
      .object({
        offset: z.coerce.number().int().min(0).max(5000).default(0),
        limit: z.coerce.number().int().min(1).max(30).default(8)
      })
      .parse(request.query);
    const projectPath = await projectPathFor(request.params);

    return readGitActivity(projectPath, query.offset, query.limit);
  });

  app.get("/api/projects/:id/git/diff", async (request) => {
    const query = z
      .object({
        path: gitFilePathSchema,
        previousPath: gitFilePathSchema.nullish(),
        staged: z.enum(["true", "false"]).transform((value) => value === "true").default("false")
      })
      .parse(request.query);
    const projectPath = await projectPathFor(request.params);

    return readGitFileDiff(projectPath, query.path, query.previousPath ?? null, query.staged);
  });

  app.post("/api/projects/:id/git/pull", async (request) => actions.pull(await projectPathFor(request.params)));

  app.post("/api/projects/:id/git/pull-develop", async (request) =>
    actions.pullDevelop(await projectPathFor(request.params))
  );

  app.post("/api/projects/:id/git/stage-all", async (request) => actions.stageAll(await projectPathFor(request.params)));

  app.post("/api/projects/:id/git/stage", async (request) => {
    const body = gitFileActionBodySchema.parse(request.body);
    return actions.stage(await projectPathFor(request.params), body.path, body.previousPath);
  });

  app.post("/api/projects/:id/git/unstage-all", async (request) =>
    actions.unstageAll(await projectPathFor(request.params))
  );

  app.post("/api/projects/:id/git/unstage", async (request) => {
    const body = gitFileActionBodySchema.parse(request.body);
    return actions.unstage(await projectPathFor(request.params), body.path, body.previousPath);
  });

  app.post("/api/projects/:id/git/commit", async (request) => {
    const body = z.object({ message: commitMessageSchema }).parse(request.body);
    return actions.commit(await projectPathFor(request.params), body.message);
  });

  app.post("/api/projects/:id/git/stash", async (request) => {
    const body = z.object({ message: stashMessageSchema.optional() }).parse(request.body ?? {});
    return actions.stash(await projectPathFor(request.params), body.message);
  });

  app.post("/api/projects/:id/git/stash-pop", async (request) => {
    const body = z.object({ ref: gitStashRefSchema }).parse(request.body);
    return actions.stashPop(await projectPathFor(request.params), body.ref);
  });

  app.post("/api/projects/:id/git/push", async (request) => actions.push(await projectPathFor(request.params)));

  app.post("/api/projects/:id/git/checkout", async (request, reply) => {
    const body = z.object({ branch: gitRefSchema, remote: z.boolean().default(false) }).parse(request.body);
    const projectPath = await projectPathFor(request.params);

    return sendGuarded(reply, await actions.checkout(projectPath, body.branch, body.remote));
  });

  app.post("/api/projects/:id/git/branch", async (request, reply) => {
    const body = z.object({ branch: gitRefSchema }).parse(request.body);
    const projectPath = await projectPathFor(request.params);

    return sendGuarded(reply, await actions.createBranch(projectPath, body.branch));
  });
}
