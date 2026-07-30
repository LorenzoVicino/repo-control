import cors from "@fastify/cors";
import Fastify, { LogController } from "fastify";
import { readEnv } from "./config/env.js";
import type { ServerEnv } from "./config/env.js";
import { runProjectCommand, runShellCommand } from "./lib/commandRunner.js";
import { createProjectResolver } from "./lib/projectResolver.js";
import type { ProjectResolver } from "./lib/projectResolver.js";
import { registerAppRoutes } from "./routes/appRoutes.js";
import { registerAgentSessionRoutes } from "./routes/agentSessionRoutes.js";
import { registerBrainRoutes } from "./routes/brainRoutes.js";
import { registerClaudeRoutes } from "./routes/claudeRoutes.js";
import { registerDockerRoutes } from "./routes/dockerRoutes.js";
import { registerGitRoutes } from "./routes/gitRoutes.js";
import { registerTerminalRoutes } from "./routes/terminalRoutes.js";
import { registerWorkflowRoutes } from "./routes/workflowRoutes.js";
import { reconcileStaleWorkflowRuns } from "./services/workflowService.js";

const STARTUP_BANNER_CONTENT_WIDTH = 76;

export async function createServer(): Promise<{
  app: ReturnType<typeof Fastify>;
  env: ServerEnv;
  projectResolver: ProjectResolver;
}> {
  const env = readEnv();
  const projectResolver = createProjectResolver(env.REPO_CONTROL_ROOT);
  const app = Fastify({
    logController: new LogController({ disableRequestLogging: true }),
    logger: {
      level: env.LOG_LEVEL
    }
  });
  let restartTimer: NodeJS.Timeout | null = null;

  function scheduleServerRestart(): void {
    if (restartTimer) {
      return;
    }

    restartTimer = setTimeout(() => {
      app.log.info("Restarting repo-control after update");
      process.exit(0);
    }, 1200);
    restartTimer.unref();
  }

  await app.register(cors, {
    origin: ["http://127.0.0.1:5173", "http://localhost:5173"]
  });

  app.addHook("onError", async (request, reply, error) => {
    request.log.error(
      {
        err: error,
        method: request.method,
        statusCode: reply.statusCode,
        url: request.url
      },
      "API error"
    );
  });

  const context = {
    ...projectResolver,
    runProjectCommand,
    runShellCommand,
    scheduleServerRestart
  };

  // A "pending"/"running" run left over from a previous process (crash, restart, kill)
  // can never be resumed or cancelled - its in-memory AbortController is gone. Mark it
  // "interrupted" before serving any workflow traffic.
  await reconcileStaleWorkflowRuns();

  await registerAppRoutes(app, context);
  await registerAgentSessionRoutes(app, context);
  await registerDockerRoutes(app, context);
  await registerGitRoutes(app, context);
  await registerTerminalRoutes(app, context);
  await registerBrainRoutes(app, context);
  await registerClaudeRoutes(app, context);
  await registerWorkflowRoutes(app, context);

  return {
    app,
    env,
    projectResolver
  };
}

export async function startServer(): Promise<void> {
  const { app, env, projectResolver } = await createServer();

  await app.listen({ host: env.HOST, port: env.PORT });
  console.log(getStartupBanner(env, projectResolver.getActiveRootPath()));
}

function getStartupBanner(env: ServerEnv, activeRootPath: string): string {
  const apiHost = env.HOST === "127.0.0.1" ? "localhost" : env.HOST;

  return [
    "",
    bannerBorder("="),
    bannerLine(),
    bannerLine(centerBannerText("repo-control")),
    bannerLine(centerBannerText("local repository command center")),
    bannerLine(),
    bannerBorder("-"),
    ...bannerField("UI", "http://localhost:5173"),
    ...bannerField("API", `http://${apiHost}:${env.PORT}`),
    ...bannerField("Root", activeRootPath),
    ...bannerField("Logs", "errors only"),
    bannerBorder("-"),
    bannerLine(centerBannerText("Ready. Open the UI and manage your workspace.")),
    bannerLine(),
    bannerBorder("="),
    ""
  ].join("\n");
}

function bannerBorder(character: string): string {
  return `  +${character.repeat(STARTUP_BANNER_CONTENT_WIDTH + 2)}+`;
}

function bannerLine(content = ""): string {
  const normalizedContent = content.slice(0, STARTUP_BANNER_CONTENT_WIDTH);

  return `  | ${normalizedContent.padEnd(STARTUP_BANNER_CONTENT_WIDTH)} |`;
}

function centerBannerText(content: string): string {
  const safeContent = content.slice(0, STARTUP_BANNER_CONTENT_WIDTH);
  const leftPadding = Math.max(0, Math.floor((STARTUP_BANNER_CONTENT_WIDTH - safeContent.length) / 2));

  return `${" ".repeat(leftPadding)}${safeContent}`;
}

function bannerField(label: string, value: string): string[] {
  const labelWidth = 8;
  const prefix = `  ${label.padEnd(labelWidth)}`;
  const availableValueWidth = STARTUP_BANNER_CONTENT_WIDTH - prefix.length;
  const chunks = splitBannerValue(value, availableValueWidth);

  return chunks.map((chunk, index) => {
    const rowPrefix = index === 0 ? prefix : " ".repeat(prefix.length);

    return bannerLine(`${rowPrefix}${chunk}`);
  });
}

function splitBannerValue(value: string, width: number): string[] {
  if (value.length <= width) {
    return [value];
  }

  const chunks: string[] = [];
  let remainingValue = value;

  while (remainingValue.length > width) {
    chunks.push(remainingValue.slice(0, width));
    remainingValue = remainingValue.slice(width);
  }

  if (remainingValue) {
    chunks.push(remainingValue);
  }

  return chunks;
}
