import cors from "@fastify/cors";
import Fastify, { LogController } from "fastify";
import { readEnv } from "./config/env.js";
import { hasBuiltWebAssets, webDistPath } from "./lib/appPaths.js";
import { registerWebAssets } from "./webAssets.js";
import type { ServerEnv } from "./config/env.js";
import { runProjectCommand, runShellCommand } from "./lib/commandRunner.js";
import { createProjectResolver } from "./lib/projectResolver.js";
import type { ProjectResolver } from "./lib/projectResolver.js";
import { getAllowedHostnames, isAllowedRequestHost } from "./lib/requestHost.js";
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
  servesWeb: boolean;
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

  // Runs before routing, so a rebound request is rejected before it can resolve a project
  // or start a command. See lib/requestHost.ts for why the Host header is the check that
  // holds once CORS has been bypassed.
  const allowedHostnames = getAllowedHostnames(env.HOST, env.ALLOWED_HOSTS);

  app.addHook("onRequest", async (request, reply) => {
    if (isAllowedRequestHost(request.headers.host, allowedHostnames)) {
      return;
    }

    request.log.warn({ host: request.headers.host, url: request.url }, "Rejected unexpected Host header");

    return reply.code(403).send({
      ok: false,
      code: "FORBIDDEN_HOST",
      message: "Request rejected: unexpected Host header."
    });
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

  // Registered after the API routes so the asset wildcard can never take precedence over
  // an /api path, and only when a build is actually present - an installed package always
  // ships one, a checkout only has one after npm run build.
  const servesWeb = env.REPO_CONTROL_SERVE_WEB && hasBuiltWebAssets();

  if (servesWeb) {
    await registerWebAssets(app, webDistPath);
  }

  return {
    app,
    env,
    projectResolver,
    servesWeb
  };
}

export async function startServer(): Promise<void> {
  const { app, env, projectResolver, servesWeb } = await createServer();

  await app.listen({ host: env.HOST, port: env.PORT });
  console.log(getStartupBanner(env, projectResolver.getActiveRootPath(), servesWeb));
}

function getStartupBanner(env: ServerEnv, activeRootPath: string, servesWeb: boolean): string {
  const apiHost = env.HOST === "127.0.0.1" ? "localhost" : env.HOST;
  // When this process serves the build, the UI lives on the API port. Otherwise the Vite
  // dev server owns it on its own port.
  const uiUrl = servesWeb ? `http://${apiHost}:${env.PORT}` : `http://${apiHost}:5173`;

  return [
    "",
    bannerBorder("="),
    bannerLine(),
    bannerLine(centerBannerText("repo-control")),
    bannerLine(centerBannerText("local repository command center")),
    bannerLine(),
    bannerBorder("-"),
    ...bannerField("UI", uiUrl),
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
