import type { FastifyInstance } from "fastify";
import { promises as fs } from "node:fs";
import { z } from "zod";
import { openNativeFolderPicker } from "../folderPicker.js";
import { readProjectSummary, scanProjects } from "../gitScanner.js";
import type { CommandResult, CommandRunner } from "../lib/commandRunner.js";
import { resolveRootInput } from "../lib/projectResolver.js";
import type { ProjectResolver } from "../lib/projectResolver.js";
import { readPreferences, writePreferences } from "../preferences.js";
import {
  getVSCodeFailureHint,
  getVSCodeLauncherCandidates
} from "../runtime.js";
import { readAppUpdateStatus, updateApplication } from "../services/appUpdateService.js";
import type { AuthGuard } from "../services/authService.js";

type AppRoutesContext = ProjectResolver & {
  auth: AuthGuard;
  runProjectCommand: CommandRunner;
  scheduleServerRestart: () => void;
};

const PROJECT_SCAN_TIMEOUT_MS = 30_000;
const SLOW_PROJECT_SCAN_MS = 2_000;

export async function registerAppRoutes(app: FastifyInstance, context: AppRoutesContext): Promise<void> {
  // Left outside the sign-in gate so a supervisor or an E2E harness can wait for the API
  // to answer, which means the workspace root has to stay behind it: the path alone tells a
  // caller where this machine keeps its code.
  app.get("/api/health", async (request) => {
    if (!context.auth.isAuthenticatedRequest(request.headers.cookie)) {
      return { ok: true, authRequired: true };
    }

    return {
      ok: true,
      root: context.getActiveRootPath()
    };
  });

  app.get("/api/projects", async (request, reply) => {
    const rootPath = context.getActiveRootPath();
    const scanController = new AbortController();
    const startedAt = performance.now();
    let timedOut = false;
    const abortScan = () => scanController.abort(new Error("Project scan request cancelled"));
    const scanTimeout = setTimeout(() => {
      timedOut = true;
      scanController.abort(new Error("Project scan timed out"));
    }, PROJECT_SCAN_TIMEOUT_MS);
    scanTimeout.unref();
    request.raw.once("aborted", abortScan);

    try {
      const projects = await scanProjects(rootPath, { signal: scanController.signal });
      const durationMs = Math.round(performance.now() - startedAt);

      if (request.raw.aborted) return reply;

      if (timedOut) {
        request.log.warn({ durationMs, rootPath }, "Project scan timed out");
        return reply.code(504).send({
          ok: false,
          code: "PROJECT_SCAN_TIMEOUT",
          message: "Project scan timed out. Choose a narrower workspace folder and try again."
        });
      }

      if (durationMs >= SLOW_PROJECT_SCAN_MS) {
        request.log.warn({ durationMs, projectCount: projects.length, rootPath }, "Slow project scan");
      }

      return { root: rootPath, projects };
    } finally {
      clearTimeout(scanTimeout);
      request.raw.removeListener("aborted", abortScan);
    }
  });

  app.get("/api/projects/:id/summary", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const rootPath = context.getActiveRootPath();
    const projectPath = await context.resolveProjectPath(params.id);
    const project = await readProjectSummary(projectPath, rootPath);

    if (!project) {
      return reply.code(404).send({ message: "Unable to read project summary" });
    }

    return project;
  });

  app.get("/api/preferences", async () => readPreferences());

  app.put("/api/preferences", async (request) => {
    const body = z
      .object({
        favoriteProjectIds: z.array(z.string().trim().min(1).max(2048)).max(2000)
      })
      .parse(request.body);

    return writePreferences(body);
  });

  app.get("/api/app/update-status", async () => readAppUpdateStatus());

  app.post("/api/root", async (request, reply) => {
    const body = z.object({ root: z.string().min(1) }).parse(request.body);
    const nextRootPath = resolveRootInput(body.root);
    const stat = await fs.stat(nextRootPath).catch(() => null);

    if (!stat?.isDirectory()) {
      return reply.code(400).send({
        ok: false,
        message: "Root path must be an existing directory"
      });
    }

    context.setActiveRootPath(nextRootPath);

    return {
      ok: true,
      root: context.getActiveRootPath()
    };
  });

  app.post("/api/folder-picker", async (request, reply) => {
    const body = z.object({ initialPath: z.string().optional() }).parse(request.body ?? {});
    const initialPath = body.initialPath ? resolveRootInput(body.initialPath) : context.getActiveRootPath();
    const pickerResult = await openNativeFolderPicker(initialPath, context.runProjectCommand);

    if (pickerResult.cancelled) {
      return {
        ok: false,
        cancelled: true,
        message: "Folder selection cancelled"
      };
    }

    if (!pickerResult.path) {
      return reply.code(501).send({
        ok: false,
        message: pickerResult.message ?? "No supported folder picker found for this environment"
      });
    }

    const pickedPath = resolveRootInput(pickerResult.path);
    const stat = await fs.stat(pickedPath).catch(() => null);

    if (!stat?.isDirectory()) {
      return reply.code(400).send({
        ok: false,
        message: "Selected path must be an existing directory"
      });
    }

    return {
      ok: true,
      path: pickedPath
    };
  });

  app.post("/api/app/update", async () => {
    const result = await updateApplication();

    if (result.ok) {
      context.scheduleServerRestart();
    }

    return {
      ...result,
      restartScheduled: result.ok
    };
  });

  app.post("/api/projects/:id/open-vscode", async (request, reply) => {
    const params = z.object({ id: z.string() }).parse(request.params);
    const projectPath = await context.resolveProjectPath(params.id);

    return reply.send(await openProjectInVSCode(projectPath, context.runProjectCommand));
  });
}

async function openProjectInVSCode(projectPath: string, runProjectCommand: CommandRunner): Promise<CommandResult> {
  const candidates = await getVSCodeLauncherCandidates();
  const failures: string[] = [];

  for (const candidate of candidates) {
    const result = await runProjectCommand(
      projectPath,
      candidate.command,
      [...candidate.args, projectPath],
      1000 * 20,
      { displayCommand: [candidate.command, ...candidate.args, projectPath].join(" "), shell: candidate.shell }
    );

    if (result.ok) {
      return result;
    }

    failures.push(`${result.command}\n${result.output || "No output"}`);
  }

  return {
    ok: false,
    command: "open VS Code",
    exitCode: null,
    stdout: "",
    stderr: failures.join("\n\n"),
    output: [
      "Unable to launch VS Code from this Node process.",
      await getVSCodeFailureHint(),
      "",
      "Tried:",
      ...failures.map((failure) => `- ${failure.split("\n")[0]}`)
    ].join("\n"),
    durationMs: 0
  };
}
