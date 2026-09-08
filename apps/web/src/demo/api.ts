import type { AgentSessionsResponse } from "../types/agentSessions";
import type { DockerContainer, ContainerSessionRead } from "../types/docker";
import type { WorkflowDefinition, WorkflowRun } from "../types/workflows";
import type { UserPreferences } from "../types/workspace";
import {
  createDemoDetails,
  createDemoProjects,
  createDemoWorkflow,
  DEMO_DATE,
  DEMO_ROOT,
} from "./fixtures";

const projects = createDemoProjects();
const details = new Map(
  projects.map((project) => [project.id, createDemoDetails(project)]),
);
const workflows = [createDemoWorkflow()];
const runs: WorkflowRun[] = [];
let preferences: UserPreferences = {
  favoriteProjectIds: [projects[0].id, projects[2].id],
  recentProjectIds: [projects[0].id],
  dashboard: null,
};
let completed = false;
let sequence = 0;
const now = () => new Date().toISOString();
const containers: DockerContainer[] = projects
  .filter((project) => project.hasDockerCompose)
  .map((project, index) => ({
    id: `abc12300000${index}`,
    name: `${project.name}-web-1`,
    image: "nginx:alpine",
    status: "Up 2 hours (healthy)",
    ports: "",
    runningFor: "2 hours",
    composeProject: project.name,
    composeService: "web",
    composeWorkingDir: project.path,
  }));
const sessions = new Map<string, ContainerSessionRead>();
const success = (
  command: string,
  output = "Simulated operation completed.",
) => ({
  ok: true,
  command,
  exitCode: 0,
  stdout: output,
  stderr: "",
  output,
  durationMs: 120,
});
const unsupported = () =>
  Response.json(
    {
      message:
        "This action requires the local app. Use Run on your machine to get started.",
      code: "DEMO_LOCAL_ONLY",
    },
    { status: 409 },
  );

function syncProject(id: string) {
  const project = projects.find((item) => item.id === id)!;
  const detail = details.get(id)!;
  project.staged = detail.status.files.staged.length;
  project.modified = detail.status.files.unstaged.filter(
    (file) => file.status !== "untracked",
  ).length;
  project.untracked = detail.status.files.unstaged.filter(
    (file) => file.status === "untracked",
  ).length;
  project.isClean = project.staged + project.modified + project.untracked === 0;
  detail.status.isClean = project.isClean;
  detail.status.ahead = project.ahead;
  detail.status.behind = project.behind;
  detail.status.diff.staged = {
    files: project.staged,
    additions: project.staged,
    deletions: 0,
    binaryFiles: 0,
    untrackedFiles: 0,
  };
  detail.status.diff.unstaged = {
    files: project.modified + project.untracked,
    additions: project.modified + project.untracked,
    deletions: 0,
    binaryFiles: 0,
    untrackedFiles: project.untracked,
  };
  for (const branch of detail.branches.local)
    if (branch.current) {
      branch.ahead = project.ahead;
      branch.behind = project.behind;
      branch.lastCommit = project.lastCommit;
    }
}

// A closed transport: every demo request ends here, including unsupported endpoints.
// It never falls through to fetch or accesses a visitor's local API.
export async function demoRequest(
  endpoint: string,
  init?: RequestInit,
): Promise<Response> {
  if (init?.signal?.aborted)
    throw new DOMException("Request aborted", "AbortError");
  const url = new URL(endpoint, "https://demo.invalid");
  const route = url.pathname;
  const method = init?.method ?? "GET";
  const body: Record<string, unknown> =
    typeof init?.body === "string" ? JSON.parse(init.body) : {};
  const reply = (value: unknown) => Response.json(value);
  if (route === "/api/auth/session")
    return reply({ authRequired: false, authenticated: true, username: null });
  if (route === "/api/health") return reply({ ok: true, root: DEMO_ROOT });
  if (route === "/api/setup") {
    if (method === "PUT") {
      completed = true;
      return reply({ ok: true });
    }
    return reply({ completed, existing: true });
  }
  if (route === "/api/setup/tools") {
    return reply({
      tools: [
        "Git",
        "Docker",
        "VS Code",
        "Codex",
        "Claude Code",
        "Gemini CLI",
      ].map((label) => ({
        id: label.toLowerCase(),
        label: `${label} (demo)`,
        required: label === "Git",
        status: "available",
      })),
    });
  }
  if (route === "/api/projects") return reply({ root: DEMO_ROOT, projects });
  if (route === "/api/preferences") {
    if (method === "PUT") preferences = { ...preferences, ...body };
    return reply(preferences);
  }
  if (route === "/api/app/update-status")
    return reply({
      currentVersion: "0.14.0",
      latestVersion: null,
      updateAvailable: false,
      checkedAt: now(),
      error: null,
    });
  if (route === "/api/agent-sessions") {
    const providers = ["codex", "claude", "gemini"] as const;
    const response: AgentSessionsResponse = {
      root: DEMO_ROOT,
      scannedAt: now(),
      warnings: [],
      agents: providers.map((id) => ({
        id,
        label:
          id === "claude"
            ? "Claude Code"
            : id === "codex"
              ? "Codex"
              : "Gemini CLI",
        installed: true,
        used: true,
        command: id,
        sessionCount: 1,
      })),
      sessions: providers.map((provider, index) => ({
        id: `demo-${provider}`,
        provider,
        providerLabel: provider,
        projectId: projects[index].id,
        projectName: projects[index].name,
        projectPath: projects[index].path,
        title: [
          "Add workspace onboarding",
          "Improve keyboard navigation",
          "Review shared components",
        ][index],
        preview:
          "Fictional conversation: inspect the repository, discuss the change, and verify the result.",
        branch: "main",
        startedAt: DEMO_DATE,
        updatedAt: DEMO_DATE,
        match: null,
      })),
    };
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    response.sessions = response.sessions.filter((item) =>
      `${item.title} ${item.preview}`.toLowerCase().includes(search),
    );
    return reply(response);
  }
  if (route === "/api/docker/containers")
    return reply({
      ok: true,
      containers,
      groups: containers.map((container) => ({
        id: container.id,
        name: container.composeProject,
        composeProject: container.composeProject,
        workingDir: container.composeWorkingDir,
        containers: [container],
      })),
      checkedAt: now(),
      error: null,
    });
  if (route === "/api/docker/stats")
    return reply({
      ok: true,
      stats: containers.map((container) => ({
        id: container.id,
        name: container.name,
        cpuPercent: 1.2,
        memoryUsedBytes: 32e6,
        memoryLimitBytes: 512e6,
        memoryPercent: 6.25,
        networkInBytes: 1200,
        networkOutBytes: 800,
        blockReadBytes: 0,
        blockWriteBytes: 0,
        processCount: 3,
      })),
      checkedAt: now(),
      error: null,
    });
  const consoleMatch = route.match(
    /^\/api\/docker\/containers\/([^/]+)\/(logs|exec)$/,
  );
  if (consoleMatch && method === "POST") {
    const container = containers.find((item) => item.id === consoleMatch[1]);
    if (!container) return unsupported();
    const id = `console-${++sequence}`;
    const session: ContainerSessionRead = {
      id,
      kind: consoleMatch[2] === "logs" ? "logs" : "exec",
      containerId: container.id,
      containerName: container.name,
      shell: "sh",
      command: "Demo console",
      createdAt: now(),
      running: false,
      exitCode: 0,
      cursor: 1,
      chunk:
        "[demo] Web service ready. GET /health 200 OK\nLocal installation is required for an interactive shell.\n",
      truncated: false,
    };
    sessions.set(id, session);
    return reply(session);
  }
  const sessionMatch = route.match(/^\/api\/docker\/sessions\/([^/]+)$/);
  if (sessionMatch) {
    if (method === "DELETE") {
      sessions.delete(sessionMatch[1]);
      return reply({ ok: true });
    }
    const session = sessions.get(sessionMatch[1]);
    return session
      ? reply({
          ...session,
          chunk:
            Number(url.searchParams.get("cursor")) > 0 ? "" : session.chunk,
        })
      : unsupported();
  }
  const projectMatch = route.match(/^\/api\/projects\/([^/]+)\/(.+)$/);
  if (projectMatch) {
    const [, id, action] = projectMatch;
    const project = projects.find((item) => item.id === id);
    const detail = details.get(id);
    if (!project || !detail) return unsupported();
    if (action === "summary") return reply(project);
    if (action === "git/details") return reply(detail);
    if (action === "git/activity")
      return reply({
        commits:
          Number(url.searchParams.get("offset")) > 0
            ? []
            : [
                {
                  ...project.lastCommit,
                  hash: project.lastCommit!.hash,
                  shortHash: project.lastCommit!.hash,
                  refs: [project.branch],
                },
              ],
        offset: 0,
        limit: 8,
        hasMore: false,
        nextOffset: null,
      });
    if (action === "git/diff")
      return reply({
        path: url.searchParams.get("path"),
        previousPath: null,
        staged: url.searchParams.get("staged") === "true",
        patch:
          "diff --git a/README.md b/README.md\n--- a/README.md\n+++ b/README.md\n@@ -1 +1,2 @@\n # Example project\n+Document the getting-started workflow.\n",
        additions: 1,
        deletions: 0,
        binary: false,
        truncated: false,
      });
    if (action === "terminal/suggestions")
      return reply({
        suggestions: ["git status", "git log --oneline -5", "pwd"],
      });
    if (action === "terminal/run") {
      const command = String(body.command).trim();
      if (command === "pwd") return reply(success(command, project.path));
      if (command === "git status")
        return reply(
          success(
            command,
            `On branch ${project.branch}\n${project.isClean ? "Working tree clean" : "Changes to review in the Changes tab"}`,
          ),
        );
      if (command === "git log --oneline -5")
        return reply(
          success(
            command,
            `${project.lastCommit?.hash} ${project.lastCommit?.message}`,
          ),
        );
      return unsupported();
    }
    if (action === "docker/compose")
      return reply({
        ok: true,
        name: project.name,
        services: project.hasDockerCompose
          ? [
              {
                name: "web",
                containerId: containers.find(
                  (item) => item.composeProject === project.name,
                )?.id,
                containerName: `${project.name}-web-1`,
                image: "nginx:alpine",
                state: "running",
                status: "Up 2 hours",
                health: "healthy",
                runningFor: "2 hours",
                ports: [],
              },
            ]
          : [],
        checkedAt: now(),
        error: null,
      });
    if (action === "docker/logs")
      return reply(
        success(
          "docker logs (demo)",
          "[demo] Web service ready. GET /health 200 OK",
        ),
      );
    if (
      method === "POST" &&
      ["git/stage", "git/stage-all", "git/unstage", "git/unstage-all"].includes(
        action,
      )
    ) {
      const staging = action === "git/stage" || action === "git/stage-all";
      const source = staging ? "unstaged" : "staged";
      const target = staging ? "staged" : "unstaged";
      const moving = detail.status.files[source].filter(
        (file) => action.endsWith("-all") || file.path === body.path,
      );
      detail.status.files[source] = detail.status.files[source].filter(
        (file) => !moving.includes(file),
      );
      detail.status.files[target].push(
        ...moving.map((file) => ({
          ...file,
          status: staging ? ("staged" as const) : ("modified" as const),
        })),
      );
      syncProject(id);
      return reply(success(action));
    }
    if (method === "POST" && action === "git/commit") {
      if (!project.staged || !String(body.message ?? "").trim())
        return reply({
          ...success(action),
          ok: false,
          exitCode: 1,
          output: "Stage a file and enter a commit message first.",
        });
      detail.status.files.staged = [];
      project.ahead += 1;
      project.lastCommit = {
        hash: `demo${++sequence}`,
        message: String(body.message),
        date: now(),
        author: "Alex Example",
      };
      syncProject(id);
      return reply(
        success(
          action,
          "Demo commit created. Your real repositories are untouched.",
        ),
      );
    }
    if (
      method === "POST" &&
      ["git/fetch", "git/pull", "git/push"].includes(action)
    ) {
      if (action === "git/pull") {
        if (!project.isClean) return unsupported();
        project.behind = 0;
      }
      if (action === "git/push") project.ahead = 0;
      syncProject(id);
      return reply(success(action));
    }
    return unsupported();
  }
  if (route === "/api/workflows") {
    if (method === "POST") return unsupported();
    return reply({ workflows });
  }
  if (route === "/api/workflow-runs") return reply({ runs });
  const workflowMatch = route.match(
    /^\/api\/workflows\/([^/]+)(?:\/(run|dry-run|runs))?$/,
  );
  if (workflowMatch) {
    const workflow = workflows.find((item) => item.id === workflowMatch[1]);
    if (!workflow) return unsupported();
    if (workflowMatch[2] === "runs")
      return reply({
        runs: runs.filter((run) => run.workflowId === workflow.id),
      });
    if (method === "PUT" || method === "DELETE") return unsupported();
    if (method === "POST") {
      const preview = workflowMatch[2] === "dry-run";
      const run: WorkflowRun = {
        id: `run-${++sequence}`,
        workflowId: workflow.id,
        workflowName: workflow.name,
        mode: preview ? "dry-run" : "run",
        status: preview ? "success" : "running",
        startedAt: now(),
        completedAt: preview ? now() : "",
        durationMs: 0,
        steps: [],
        summary: {
          selectedProjects: projects.length,
          succeeded: 0,
          failed: 0,
          skipped: 0,
          commands: 0,
        },
        statusMessage: "Simulated fetch; no real commands are executed.",
      };
      if (preview) finishRun(run, workflow);
      else
        setTimeout(() => {
          if (run.status === "running") finishRun(run, workflow);
        }, 1800);
      runs.unshift(run);
      return reply(run);
    }
  }
  const runMatch = route.match(/^\/api\/workflow-runs\/([^/]+)(\/cancel)?$/);
  if (runMatch) {
    const run = runs.find((item) => item.id === runMatch[1]);
    if (!run) return unsupported();
    if (runMatch[2]) {
      run.status = "cancelled";
      run.completedAt = now();
      return reply({ ok: true });
    }
    return reply(run);
  }
  return unsupported();
}

function finishRun(run: WorkflowRun, workflow: WorkflowDefinition) {
  run.status = "success";
  run.completedAt = now();
  run.durationMs = run.mode === "dry-run" ? 0 : 1800;
  run.steps = projects.map((project, index) => ({
    id: `${run.id}-${index}`,
    nodeId: "fetch",
    nodeName: workflow.nodes[2].name,
    nodeType: "git.fetch",
    status: "success",
    projectId: project.id,
    projectName: project.name,
    command: "git fetch --all --prune",
    message: "Simulated fetch completed",
    stdout: "Demo remote checked",
    stderr: "",
    durationMs: 120,
  }));
  run.summary = {
    selectedProjects: projects.length,
    succeeded: projects.length,
    failed: 0,
    skipped: 0,
    commands: projects.length,
  };
}
