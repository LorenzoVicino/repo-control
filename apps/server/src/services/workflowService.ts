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
  mutateWorkflowFile,
  readWorkflowFile,
  readWorkflowRunsFile,
  rememberWorkflowRun
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

export async function executeWorkflow(
  workflowId: string,
  mode: WorkflowRunMode,
  context: WorkflowExecutionContext,
  inputs: WorkflowRunInputs = {}
): Promise<WorkflowRun | null> {
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
  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const projects = await scanProjects(context.getActiveRootPath());
  let selectedProjects = projects;
  const steps: WorkflowRunStep[] = [];
  let previousNodeFailed = false;

  for (const node of orderedNodes) {
    if (previousNodeFailed) {
      steps.push(createStep(node, "skipped", null, null, "Skipped because a previous step failed"));
      continue;
    }

    switch (node.type) {
      case "trigger.manual":
        steps.push(createStep(node, "success", null, null, "Manual trigger ready"));
        break;
      case "input.text": {
        const definition = resolvedInputs.definitions.find((input) => input.nodeId === node.id);
        const value = definition ? resolvedInputs.values[definition.key] : "";
        const message = value
          ? `Input "${definition?.label ?? node.name}" received`
          : `Optional input "${definition?.label ?? node.name}" left empty`;
        steps.push(createStep(node, "success", null, null, message));
        break;
      }
      case "repository.select":
        selectedProjects = await selectProjects(projects, node);
        steps.push(createStep(node, "success", null, null, `${selectedProjects.length} repository selected`));
        break;
      case "repository.filter": {
        const beforeCount = selectedProjects.length;
        selectedProjects = filterProjects(selectedProjects, node);
        steps.push(createStep(node, "success", null, null, `${selectedProjects.length} of ${beforeCount} repositories matched`));
        break;
      }
      case "output.summary":
        steps.push(createStep(node, "success", null, null, `${selectedProjects.length} repositories in current selection`));
        break;
      default: {
        const nodeSteps = await executeProjectNode(
          node,
          selectedProjects,
          mode,
          context,
          terminalCommands,
          resolvedInputs.environment
        );
        steps.push(...nodeSteps);
        previousNodeFailed = mode === "run" && nodeSteps.some((step) => step.status === "failed");
        break;
      }
    }
  }

  const completedAt = new Date().toISOString();
  const summary = summarizeRun(selectedProjects.length, steps);
  const run: WorkflowRun = {
    id: randomUUID(),
    workflowId: workflow.id,
    workflowName: workflow.name,
    mode,
    status: summary.failed > 0 ? "failed" : summary.skipped > 0 ? "warning" : "success",
    startedAt,
    completedAt,
    durationMs: Date.now() - startedAtMs,
    steps,
    summary
  };

  await rememberWorkflowRun(run);
  return run;
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
  inputEnvironment: NodeJS.ProcessEnv
): Promise<WorkflowRunStep[]> {
  if (projects.length === 0) {
    return [createStep(node, "skipped", null, null, "No repositories selected")];
  }

  const steps: WorkflowRunStep[] = [];

  for (const project of projects) {
    const action = getProjectAction(node, project, context, terminalCommands, inputEnvironment);

    if (!action) {
      steps.push(createStep(node, "skipped", project, null, getSkipMessage(node, project)));
      continue;
    }

    if (mode === "dry-run") {
      steps.push(createStep(node, "success", project, action.command, "Dry run preview"));
      continue;
    }

    const startedAt = Date.now();
    const result = await action.run();

    steps.push({
      id: randomUUID(),
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      status: result.ok ? "success" : "failed",
      projectId: project.id,
      projectName: project.name,
      command: result.command,
      message: result.ok ? "Command completed" : "Command failed",
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: Date.now() - startedAt
    });
  }

  return steps;
}

function getProjectAction(
  node: WorkflowNode,
  project: ProjectSummary,
  context: WorkflowExecutionContext,
  terminalCommands: Map<string, string>,
  inputEnvironment: NodeJS.ProcessEnv
): ProjectAction | null {
  switch (node.type) {
    case "git.fetch":
      return {
        command: "git fetch --all --prune",
        run: () => context.runProjectCommand(project.path, "git", ["fetch", "--all", "--prune"])
      };
    case "git.pull":
      if (getBoolean(node.config.requireClean, true) && !project.isClean) {
        return null;
      }

      return {
        command: "git pull --ff-only",
        run: () => context.runProjectCommand(project.path, "git", ["pull", "--ff-only"], 1000 * 60 * 5)
      };
    case "git.pullDevelop":
      if (getBoolean(node.config.requireClean, true) && !project.isClean) {
        return null;
      }

      return {
        command: "git pull origin develop",
        run: () => context.runProjectCommand(project.path, "git", ["pull", "origin", "develop"], 1000 * 60 * 5)
      };
    case "git.push":
      return {
        command: "git push",
        run: () => context.runProjectCommand(project.path, "git", ["push"], 1000 * 60 * 5)
      };
    case "docker.up":
      if (!project.hasDockerCompose) {
        return null;
      }

      return {
        command: "docker compose up -d",
        run: () => context.runProjectCommand(project.path, "docker", ["compose", "up", "-d"], 1000 * 60 * 10)
      };
    case "docker.rebuild":
      if (!project.hasDockerCompose) {
        return null;
      }

      return {
        command: "docker compose up -d --build",
        run: () =>
          context.runProjectCommand(project.path, "docker", ["compose", "up", "-d", "--build"], 1000 * 60 * 10)
      };
    case "docker.stop":
      if (!project.hasDockerCompose) {
        return null;
      }

      return {
        command: "docker compose stop",
        run: () => context.runProjectCommand(project.path, "docker", ["compose", "stop"], 1000 * 60 * 5)
      };
    case "terminal.command": {
      const command = terminalCommands.get(node.id) ?? "";

      if (!command) {
        return null;
      }

      return {
        command,
        run: () => context.runShellCommand(
          project.path,
          command,
          1000 * 60 * 10,
          { env: inputEnvironment }
        )
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
