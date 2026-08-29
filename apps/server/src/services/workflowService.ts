import { randomUUID } from "node:crypto";
import { scanProjects } from "../gitScanner.js";
import type { ProjectSummary } from "../gitScanner.js";
import type { CommandResult } from "../lib/commandRunner.js";
import { readPreferences } from "../preferences.js";
import { getShellEnvironmentReference } from "../runtime.js";
import {
  interpolateWorkflowInputReferences,
  resolveWorkflowInputs
} from "./workflow/input.js";
import { normalizeWorkflowDefinition } from "./workflow/schema.js";
import {
  insertWorkflowRun,
  mutateWorkflowFile,
  readWorkflowFile,
  readWorkflowRun,
  readWorkflowRunsFile,
  reconcileStaleWorkflowRuns as reconcileStaleWorkflowRunsInStore,
  updateWorkflowRun
} from "./workflow/store.js";
import type {
  WorkflowDefinition,
  WorkflowDraft,
  WorkflowExecutionContext,
  WorkflowListResponse,
  WorkflowNode,
  WorkflowRun,
  WorkflowRunInputs,
  WorkflowRunMode,
  WorkflowRunsResponse,
  WorkflowRunStep,
  WorkflowRunSummary,
  WorkflowStepStatus
} from "./workflow/types.js";
import { getExecutableWorkflowNodes } from "./workflow/validation.js";
import { getBoolean, getString, getStringArray } from "./workflow/value.js";

type ProjectAction = {
  command: string;
  run: () => Promise<CommandResult>;
};

export class WorkflowRunConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowRunConflictError";
  }
}

// In-memory only: lost on restart, which is exactly why reconcileStaleWorkflowRuns()
// exists (a run that was "active" before a restart can never be resumed or cancelled).
const activeRuns = new Map<string, { workflowId: string; abortController: AbortController }>();
const activeWorkflowIds = new Set<string>();

export async function readWorkflows(): Promise<WorkflowListResponse> {
  const workflowFile = await readWorkflowFile();

  return {
    workflows: workflowFile.workflows
  };
}

export async function createWorkflow(draft: WorkflowDraft): Promise<WorkflowDefinition> {
  return mutateWorkflowFile((workflowFile) => {
    const now = new Date().toISOString();
    const workflow = normalizeWorkflowDefinition({
      id: randomUUID(),
      name: draft.name,
      description: draft.description,
      active: draft.active,
      nodes: draft.nodes,
      edges: draft.edges,
      createdAt: now,
      updatedAt: now
    });

    workflowFile.workflows.push(workflow);
    return workflow;
  });
}

export async function updateWorkflow(id: string, draft: WorkflowDraft): Promise<WorkflowDefinition | null> {
  return mutateWorkflowFile((workflowFile) => {
    const existingWorkflow = workflowFile.workflows.find((workflow) => workflow.id === id);

    if (!existingWorkflow) {
      return null;
    }

    const workflow = normalizeWorkflowDefinition({
      ...existingWorkflow,
      name: draft.name,
      description: draft.description,
      active: draft.active,
      nodes: draft.nodes,
      edges: draft.edges,
      updatedAt: new Date().toISOString()
    });

    workflowFile.workflows = workflowFile.workflows.map((currentWorkflow) =>
      currentWorkflow.id === id ? workflow : currentWorkflow
    );
    return workflow;
  });
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  return mutateWorkflowFile((workflowFile) => {
    const nextWorkflows = workflowFile.workflows.filter((workflow) => workflow.id !== id);

    if (nextWorkflows.length === workflowFile.workflows.length) {
      return false;
    }

    workflowFile.workflows = nextWorkflows;
    return true;
  });
}

export async function readWorkflowRuns(workflowId?: string): Promise<WorkflowRunsResponse> {
  const runsFile = await readWorkflowRunsFile();

  return {
    runs: workflowId ? runsFile.runs.filter((run) => run.workflowId === workflowId) : runsFile.runs
  };
}

export const getWorkflowRun = readWorkflowRun;

// Called once at server boot, before routes start serving traffic.
export const reconcileStaleWorkflowRuns = reconcileStaleWorkflowRunsInStore;

export function cancelWorkflowRun(runId: string): "cancelled" | "not-active" {
  const active = activeRuns.get(runId);

  if (!active) {
    return "not-active";
  }

  active.abortController.abort();
  return "cancelled";
}

type PreparedWorkflowRun = {
  workflow: WorkflowDefinition;
  orderedNodes: WorkflowNode[];
  resolvedInputs: ReturnType<typeof resolveWorkflowInputs>;
  terminalCommands: Map<string, string>;
};

// Parsing/validation only - no I/O, no process spawning. Safe to run synchronously
// before responding to the HTTP request; throws WorkflowInputValidationError /
// WorkflowDefinitionValidationError, which routes map to 400.
async function prepareWorkflowRun(workflowId: string, inputs: WorkflowRunInputs): Promise<PreparedWorkflowRun | null> {
  const workflowFile = await readWorkflowFile();
  const workflow = workflowFile.workflows.find((currentWorkflow) => currentWorkflow.id === workflowId);

  if (!workflow) {
    return null;
  }

  const orderedNodes = getExecutableWorkflowNodes(workflow);
  const resolvedInputs = resolveWorkflowInputs(workflow.nodes, inputs);
  const terminalCommands = new Map(
    workflow.nodes
      .filter((node) => node.type === "terminal.command")
      .map((node) => [
        node.id,
        interpolateWorkflowInputReferences(
          getString(node.config.command, ""),
          resolvedInputs.definitions,
          getShellEnvironmentReference
        )
      ])
  );

  return { workflow, orderedNodes, resolvedInputs, terminalCommands };
}

function buildRun(workflow: WorkflowDefinition, mode: WorkflowRunMode, status: WorkflowRun["status"]): WorkflowRun {
  const startedAt = new Date().toISOString();

  return {
    id: randomUUID(),
    workflowId: workflow.id,
    workflowName: workflow.name,
    mode,
    status,
    startedAt,
    completedAt: "",
    durationMs: 0,
    steps: [],
    summary: summarizeRun(0, []),
    statusMessage: null
  };
}

// Dry runs never spawn a process (they only preview the command that would run), so they
// cannot hang - there's no benefit to making them async, and keeping them synchronous
// means the UI gets the full preview back in one round trip, as today.
export async function executeDryRun(
  workflowId: string,
  context: WorkflowExecutionContext,
  inputs: WorkflowRunInputs = {}
): Promise<WorkflowRun | null> {
  const prepared = await prepareWorkflowRun(workflowId, inputs);

  if (!prepared) {
    return null;
  }

  const run = buildRun(prepared.workflow, "dry-run", "running");
  const startedAtMs = Date.now();
  const { steps, selectedProjects } = await runWorkflowNodes(prepared, "dry-run", context, new AbortController().signal);

  run.completedAt = new Date().toISOString();
  run.durationMs = Date.now() - startedAtMs;
  run.steps = steps;
  run.summary = summarizeRun(selectedProjects, steps);
  run.status = run.summary.failed > 0 ? "failed" : run.summary.skipped > 0 ? "warning" : "success";

  await insertWorkflowRun(run);
  return run;
}

// Persists a "pending" record and returns immediately; execution continues in the
// background and updates the same record as it progresses.
export async function startWorkflowRun(
  workflowId: string,
  context: WorkflowExecutionContext,
  inputs: WorkflowRunInputs = {}
): Promise<WorkflowRun | null> {
  // Reserved synchronously, before any `await`, so two concurrent calls for the same
  // workflow can't both pass this check (a check-then-set split across an await point
  // would race: both callers could observe "not active" before either sets the flag).
  if (activeWorkflowIds.has(workflowId)) {
    throw new WorkflowRunConflictError(`Workflow "${workflowId}" already has a run in progress`);
  }
  activeWorkflowIds.add(workflowId);

  try {
    const prepared = await prepareWorkflowRun(workflowId, inputs);

    if (!prepared) {
      activeWorkflowIds.delete(workflowId);
      return null;
    }

    const run = buildRun(prepared.workflow, "run", "pending");
    await insertWorkflowRun(run);

    const abortController = new AbortController();
    activeRuns.set(run.id, { workflowId, abortController });

    const releaseReservation = (): void => {
      activeRuns.delete(run.id);
      activeWorkflowIds.delete(workflowId);
    };

    // The reservation is also released here as a safety net. Both deletes are idempotent,
    // so releasing twice is harmless; this only matters if the background task throws
    // before it reaches its own release.
    void runWorkflowInBackground(run, prepared, context, abortController.signal, releaseReservation)
      .finally(releaseReservation);

    return run;
  } catch (error) {
    // Preparation/validation failed before any background execution started - release
    // the reservation immediately instead of waiting for a background finally() that
    // will never run.
    activeWorkflowIds.delete(workflowId);
    throw error;
  }
}

async function runWorkflowInBackground(
  run: WorkflowRun,
  prepared: PreparedWorkflowRun,
  context: WorkflowExecutionContext,
  signal: AbortSignal,
  releaseReservation: () => void
): Promise<void> {
  const startedAtMs = Date.now();
  // Built inside the try/catch, applied afterwards, so the reservation can be released
  // before the terminal status becomes visible. See the note above the release below.
  // Both branches assign, so it is definitely set by the time it is used.
  let applyTerminalStatus: (current: WorkflowRun) => WorkflowRun;

  try {
    await updateWorkflowRun(run.id, (current) => ({ ...current, status: "running" }));

    const { steps, selectedProjects } = await runWorkflowNodes(
      prepared,
      "run",
      context,
      signal,
      async (step) => {
        await updateWorkflowRun(run.id, (current) => ({ ...current, steps: [...current.steps, step] }));
      }
    );

    const summary = summarizeRun(selectedProjects, steps);
    const status = signal.aborted
      ? "cancelled"
      : summary.failed > 0
        ? "failed"
        : summary.skipped > 0
          ? "warning"
          : "success";

    applyTerminalStatus = (current) => ({
      ...current,
      status,
      statusMessage: status === "cancelled" ? "Cancelled by user" : null,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      summary
    });
  } catch (error) {
    // Last-resort safety net: never leave a record stuck at pending/running because of an
    // unexpected error in the loop above.
    applyTerminalStatus = (current) => ({
      ...current,
      status: "failed",
      statusMessage: error instanceof Error ? error.message : "Unexpected error while running the workflow",
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs
    });
  }

  // Released before the terminal status is published, so that observing a run as finished
  // is enough to know the next one can start. Releasing afterwards left a window where the
  // API reported the run as complete while a new start still returned 409.
  releaseReservation();
  await updateWorkflowRun(run.id, applyTerminalStatus);
}

async function runWorkflowNodes(
  prepared: PreparedWorkflowRun,
  mode: WorkflowRunMode,
  context: WorkflowExecutionContext,
  signal: AbortSignal,
  onStep?: (step: WorkflowRunStep) => Promise<void>
): Promise<{ steps: WorkflowRunStep[]; selectedProjects: number }> {
  const { orderedNodes, resolvedInputs, terminalCommands } = prepared;
  const projects = await scanProjects(context.getActiveRootPath());
  let selectedProjects = projects;
  const steps: WorkflowRunStep[] = [];
  let previousNodeFailed = false;

  const pushStep = async (step: WorkflowRunStep) => {
    steps.push(step);
    if (onStep) {
      await onStep(step);
    }
  };

  for (const node of orderedNodes) {
    if (mode === "run" && signal.aborted) {
      await pushStep(createStep(node, "cancelled", null, null, "Cancelled by user"));
      continue;
    }

    if (previousNodeFailed) {
      await pushStep(createStep(node, "skipped", null, null, "Skipped because a previous step failed"));
      continue;
    }

    switch (node.type) {
      case "trigger.manual":
        await pushStep(createStep(node, "success", null, null, "Manual trigger ready"));
        break;
      case "input.text": {
        const definition = resolvedInputs.definitions.find((input) => input.nodeId === node.id);
        const value = definition ? resolvedInputs.values[definition.key] : "";
        const message = value
          ? `Input "${definition?.label ?? node.name}" received`
          : `Optional input "${definition?.label ?? node.name}" left empty`;
        await pushStep(createStep(node, "success", null, null, message));
        break;
      }
      case "repository.select":
        selectedProjects = await selectProjects(projects, node);
        await pushStep(createStep(node, "success", null, null, `${selectedProjects.length} repository selected`));
        break;
      case "repository.filter": {
        const beforeCount = selectedProjects.length;
        selectedProjects = filterProjects(selectedProjects, node);
        await pushStep(
          createStep(node, "success", null, null, `${selectedProjects.length} of ${beforeCount} repositories matched`)
        );
        break;
      }
      case "output.summary":
        await pushStep(
          createStep(node, "success", null, null, `${selectedProjects.length} repositories in current selection`)
        );
        break;
      default: {
        const nodeSteps = await executeProjectNode(
          node,
          selectedProjects,
          mode,
          context,
          terminalCommands,
          resolvedInputs.environment,
          signal
        );
        for (const step of nodeSteps) {
          await pushStep(step);
        }
        previousNodeFailed = mode === "run" && nodeSteps.some((step) => step.status === "failed");
        break;
      }
    }
  }

  return { steps, selectedProjects: selectedProjects.length };
}

async function selectProjects(projects: ProjectSummary[], node: WorkflowNode): Promise<ProjectSummary[]> {
  const mode = getString(node.config.mode, "all");

  if (mode === "manual") {
    const projectIds = new Set(getStringArray(node.config.projectIds));
    return projects.filter((project) => projectIds.has(project.id));
  }

  if (mode === "favorites") {
    const preferences = await readPreferences();
    const favoriteProjectIds = new Set(preferences.favoriteProjectIds);
    return projects.filter((project) => favoriteProjectIds.has(project.id));
  }

  return projects;
}

function filterProjects(projects: ProjectSummary[], node: WorkflowNode): ProjectSummary[] {
  const clean = getString(node.config.clean, "any");
  const sync = getString(node.config.sync, "any");
  const docker = getString(node.config.docker, "any");

  return projects.filter((project) => {
    if (clean === "clean" && !project.isClean) {
      return false;
    }

    if (clean === "dirty" && project.isClean) {
      return false;
    }

    if (sync === "behind" && project.behind <= 0) {
      return false;
    }

    if (sync === "ahead" && project.ahead <= 0) {
      return false;
    }

    if (sync === "diverged" && (project.ahead <= 0 || project.behind <= 0)) {
      return false;
    }

    if (docker === "yes" && !project.hasDockerCompose) {
      return false;
    }

    if (docker === "no" && project.hasDockerCompose) {
      return false;
    }

    return true;
  });
}

async function executeProjectNode(
  node: WorkflowNode,
  projects: ProjectSummary[],
  mode: WorkflowRunMode,
  context: WorkflowExecutionContext,
  terminalCommands: Map<string, string>,
  inputEnvironment: NodeJS.ProcessEnv,
  signal: AbortSignal
): Promise<WorkflowRunStep[]> {
  if (projects.length === 0) {
    return [createStep(node, "skipped", null, null, "No repositories selected")];
  }

  const steps: WorkflowRunStep[] = [];

  for (const project of projects) {
    if (mode === "run" && signal.aborted) {
      steps.push(createStep(node, "cancelled", project, null, "Cancelled by user"));
      continue;
    }

    const action = getProjectAction(node, project, context, terminalCommands, inputEnvironment, signal);

    if (!action) {
      steps.push(createStep(node, "skipped", project, null, getSkipMessage(node, project)));
      continue;
    }

    if (mode === "dry-run") {
      steps.push(createStep(node, "success", project, action.command, "Dry run preview"));
      continue;
    }

    const startedAt = Date.now();
    const startedAtIso = new Date().toISOString();
    const result = await action.run();
    const status: WorkflowStepStatus = signal.aborted ? "cancelled" : result.ok ? "success" : "failed";

    steps.push({
      id: randomUUID(),
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      status,
      projectId: project.id,
      projectName: project.name,
      command: result.command,
      message: status === "cancelled" ? "Cancelled by user" : result.ok ? "Command completed" : "Command failed",
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: Date.now() - startedAt,
      startedAt: startedAtIso
    });
  }

  return steps;
}

function getProjectAction(
  node: WorkflowNode,
  project: ProjectSummary,
  context: WorkflowExecutionContext,
  terminalCommands: Map<string, string>,
  inputEnvironment: NodeJS.ProcessEnv,
  signal: AbortSignal
): ProjectAction | null {
  switch (node.type) {
    case "git.fetch":
      return {
        command: "git fetch --all --prune",
        run: () =>
          context.runProjectCommand(project.path, "git", ["fetch", "--all", "--prune"], undefined, { signal })
      };
    case "git.pull":
      if (getBoolean(node.config.requireClean, true) && !project.isClean) {
        return null;
      }

      return {
        command: "git pull --ff-only",
        run: () =>
          context.runProjectCommand(project.path, "git", ["pull", "--ff-only"], 1000 * 60 * 5, { signal })
      };
    case "git.pullDevelop":
      if (getBoolean(node.config.requireClean, true) && !project.isClean) {
        return null;
      }

      return {
        command: "git pull origin develop",
        run: () =>
          context.runProjectCommand(project.path, "git", ["pull", "origin", "develop"], 1000 * 60 * 5, { signal })
      };
    case "git.push":
      return {
        command: "git push",
        run: () => context.runProjectCommand(project.path, "git", ["push"], 1000 * 60 * 5, { signal })
      };
    case "docker.up":
      if (!project.hasDockerCompose) {
        return null;
      }

      return {
        command: "docker compose up -d",
        run: () =>
          context.runProjectCommand(project.path, "docker", ["compose", "up", "-d"], 1000 * 60 * 10, { signal })
      };
    case "docker.rebuild":
      if (!project.hasDockerCompose) {
        return null;
      }

      return {
        command: "docker compose up -d --build",
        run: () =>
          context.runProjectCommand(project.path, "docker", ["compose", "up", "-d", "--build"], 1000 * 60 * 10, {
            signal
          })
      };
    case "docker.stop":
      if (!project.hasDockerCompose) {
        return null;
      }

      return {
        command: "docker compose stop",
        run: () =>
          context.runProjectCommand(project.path, "docker", ["compose", "stop"], 1000 * 60 * 5, { signal })
      };
    case "terminal.command": {
      const command = terminalCommands.get(node.id) ?? "";

      if (!command) {
        return null;
      }

      return {
        command,
        run: () =>
          context.runShellCommand(project.path, command, 1000 * 60 * 10, { env: inputEnvironment, signal })
      };
    }
    default:
      return null;
  }
}

function getSkipMessage(node: WorkflowNode, project: ProjectSummary): string {
  if ((node.type === "git.pull" || node.type === "git.pullDevelop") && !project.isClean) {
    return "Skipped because repository has local changes";
  }

  if (node.type.startsWith("docker.") && !project.hasDockerCompose) {
    return "Skipped because repository has no Docker Compose file";
  }

  if (node.type === "terminal.command") {
    return "Skipped because no terminal command is configured";
  }

  return "Skipped";
}

function createStep(
  node: WorkflowNode,
  status: WorkflowStepStatus,
  project: ProjectSummary | null,
  command: string | null,
  message: string
): WorkflowRunStep {
  return {
    id: randomUUID(),
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
    status,
    projectId: project?.id ?? null,
    projectName: project?.name ?? null,
    command,
    message,
    stdout: "",
    stderr: "",
    durationMs: 0
  };
}

function summarizeRun(selectedProjects: number, steps: WorkflowRunStep[]): WorkflowRunSummary {
  return {
    selectedProjects,
    succeeded: steps.filter((step) => step.status === "success").length,
    failed: steps.filter((step) => step.status === "failed").length,
    skipped: steps.filter((step) => step.status === "skipped").length,
    commands: steps.filter((step) => step.command).length
  };
}
