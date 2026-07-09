import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { scanProjects } from "../gitScanner.js";
import type { ProjectSummary } from "../gitScanner.js";
import type { CommandResult, CommandRunner } from "../lib/commandRunner.js";
import { getConfigDirectory, readPreferences } from "../preferences.js";

export type WorkflowNodeType =
  | "trigger.manual"
  | "repository.select"
  | "repository.filter"
  | "git.fetch"
  | "git.pull"
  | "git.pullDevelop"
  | "git.push"
  | "docker.up"
  | "docker.rebuild"
  | "docker.stop"
  | "terminal.command"
  | "output.summary";

export type WorkflowNodePosition = {
  x: number;
  y: number;
};

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  name: string;
  position: WorkflowNodePosition;
  config: Record<string, unknown>;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
};

export type WorkflowDefinition = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
};

export type WorkflowRunMode = "run" | "dry-run";
export type WorkflowRunStatus = "success" | "failed";
export type WorkflowStepStatus = "success" | "failed" | "skipped";

export type WorkflowRunStep = {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: WorkflowNodeType;
  status: WorkflowStepStatus;
  projectId: string | null;
  projectName: string | null;
  command: string | null;
  message: string;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type WorkflowRunSummary = {
  selectedProjects: number;
  succeeded: number;
  failed: number;
  skipped: number;
  commands: number;
};

export type WorkflowRun = {
  id: string;
  workflowId: string;
  workflowName: string;
  mode: WorkflowRunMode;
  status: WorkflowRunStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  steps: WorkflowRunStep[];
  summary: WorkflowRunSummary;
};

export type WorkflowListResponse = {
  workflows: WorkflowDefinition[];
};

export type WorkflowRunsResponse = {
  runs: WorkflowRun[];
};

export type WorkflowExecutionContext = {
  getActiveRootPath: () => string;
  runProjectCommand: CommandRunner;
  runShellCommand: (cwd: string, commandLine: string, timeoutMs: number) => Promise<CommandResult>;
};

type WorkflowFile = {
  version: 1;
  workflows: WorkflowDefinition[];
};

type WorkflowRunsFile = {
  version: 1;
  runs: WorkflowRun[];
};

type WorkflowDraft = {
  name?: unknown;
  description?: unknown;
  active?: unknown;
  nodes?: unknown;
  edges?: unknown;
};

type ProjectAction = {
  command: string;
  run: () => Promise<CommandResult>;
};

const MAX_WORKFLOW_RUNS = 100;

export async function readWorkflows(): Promise<WorkflowListResponse> {
  const workflowFile = await readWorkflowFile();

  return {
    workflows: workflowFile.workflows
  };
}

export async function createWorkflow(draft: WorkflowDraft): Promise<WorkflowDefinition> {
  const workflowFile = await readWorkflowFile();
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
  await writeWorkflowFile(workflowFile);
  return workflow;
}

export async function updateWorkflow(id: string, draft: WorkflowDraft): Promise<WorkflowDefinition | null> {
  const workflowFile = await readWorkflowFile();
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
  await writeWorkflowFile(workflowFile);
  return workflow;
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const workflowFile = await readWorkflowFile();
  const nextWorkflows = workflowFile.workflows.filter((workflow) => workflow.id !== id);

  if (nextWorkflows.length === workflowFile.workflows.length) {
    return false;
  }

  await writeWorkflowFile({
    version: 1,
    workflows: nextWorkflows
  });
  return true;
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
  context: WorkflowExecutionContext
): Promise<WorkflowRun | null> {
  const workflowFile = await readWorkflowFile();
  const workflow = workflowFile.workflows.find((currentWorkflow) => currentWorkflow.id === workflowId);

  if (!workflow) {
    return null;
  }

  const startedAt = new Date().toISOString();
  const startedAtMs = Date.now();
  const projects = await scanProjects(context.getActiveRootPath());
  const orderedNodes = orderWorkflowNodes(workflow);
  let selectedProjects = projects;
  const steps: WorkflowRunStep[] = [];

  for (const node of orderedNodes) {
    switch (node.type) {
      case "trigger.manual":
        steps.push(createStep(node, "success", null, null, "Manual trigger ready"));
        break;
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
      default:
        steps.push(...await executeProjectNode(node, selectedProjects, mode, context));
        break;
    }
  }

  const completedAt = new Date().toISOString();
  const summary = summarizeRun(selectedProjects.length, steps);
  const run: WorkflowRun = {
    id: randomUUID(),
    workflowId: workflow.id,
    workflowName: workflow.name,
    mode,
    status: summary.failed > 0 ? "failed" : "success",
    startedAt,
    completedAt,
    durationMs: Date.now() - startedAtMs,
    steps,
    summary
  };

  await rememberWorkflowRun(run);
  return run;
}

function orderWorkflowNodes(workflow: WorkflowDefinition): WorkflowNode[] {
  const nodesById = new Map(workflow.nodes.map((node) => [node.id, node]));
  const outgoingEdges = new Map<string, WorkflowEdge>();

  for (const edge of workflow.edges) {
    if (!outgoingEdges.has(edge.source)) {
      outgoingEdges.set(edge.source, edge);
    }
  }

  const triggerNode = workflow.nodes.find((node) => node.type === "trigger.manual") ?? workflow.nodes[0];

  if (!triggerNode) {
    return [];
  }

  const orderedNodes: WorkflowNode[] = [];
  const visitedNodeIds = new Set<string>();
  let currentNode: WorkflowNode | undefined = triggerNode;

  while (currentNode && !visitedNodeIds.has(currentNode.id)) {
    orderedNodes.push(currentNode);
    visitedNodeIds.add(currentNode.id);
    currentNode = nodesById.get(outgoingEdges.get(currentNode.id)?.target ?? "");
  }

  const remainingNodes = workflow.nodes
    .filter((node) => !visitedNodeIds.has(node.id))
    .sort((left, right) => left.position.x - right.position.x || left.position.y - right.position.y);

  return [...orderedNodes, ...remainingNodes];
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
  context: WorkflowExecutionContext
): Promise<WorkflowRunStep[]> {
  if (projects.length === 0) {
    return [createStep(node, "skipped", null, null, "No repositories selected")];
  }

  const steps: WorkflowRunStep[] = [];

  for (const project of projects) {
    const action = getProjectAction(node, project, context);

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
  context: WorkflowExecutionContext
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
      const command = getString(node.config.command, "");

      if (!command) {
        return null;
      }

      return {
        command,
        run: () => context.runShellCommand(project.path, command, 1000 * 60 * 10)
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

async function rememberWorkflowRun(run: WorkflowRun): Promise<void> {
  const runsFile = await readWorkflowRunsFile();

  await writeWorkflowRunsFile({
    version: 1,
    runs: [run, ...runsFile.runs].slice(0, MAX_WORKFLOW_RUNS)
  });
}

async function readWorkflowFile(): Promise<WorkflowFile> {
  const workflowPath = getWorkflowPath();
  const content = await fs.readFile(workflowPath, "utf8").catch(() => null);

  if (!content) {
    return {
      version: 1,
      workflows: getDefaultWorkflows()
    };
  }

  try {
    const parsed = JSON.parse(content) as Partial<WorkflowFile>;
    const workflows = Array.isArray(parsed.workflows)
      ? parsed.workflows.map(normalizeWorkflowDefinition)
      : getDefaultWorkflows();

    return {
      version: 1,
      workflows
    };
  } catch {
    return {
      version: 1,
      workflows: getDefaultWorkflows()
    };
  }
}

async function writeWorkflowFile(workflowFile: WorkflowFile): Promise<void> {
  const workflowPath = getWorkflowPath();
  const normalizedFile: WorkflowFile = {
    version: 1,
    workflows: workflowFile.workflows.map(normalizeWorkflowDefinition)
  };

  await fs.mkdir(path.dirname(workflowPath), { recursive: true });
  await fs.writeFile(`${workflowPath}.tmp`, `${JSON.stringify(normalizedFile, null, 2)}\n`, "utf8");
  await fs.rename(`${workflowPath}.tmp`, workflowPath);
}

async function readWorkflowRunsFile(): Promise<WorkflowRunsFile> {
  const workflowRunsPath = getWorkflowRunsPath();
  const content = await fs.readFile(workflowRunsPath, "utf8").catch(() => null);

  if (!content) {
    return {
      version: 1,
      runs: []
    };
  }

  try {
    const parsed = JSON.parse(content) as Partial<WorkflowRunsFile>;
    const runs = Array.isArray(parsed.runs)
      ? parsed.runs.map(normalizeWorkflowRun).filter((run): run is WorkflowRun => run !== null)
      : [];

    return {
      version: 1,
      runs: runs.slice(0, MAX_WORKFLOW_RUNS)
    };
  } catch {
    return {
      version: 1,
      runs: []
    };
  }
}

async function writeWorkflowRunsFile(workflowRunsFile: WorkflowRunsFile): Promise<void> {
  const workflowRunsPath = getWorkflowRunsPath();
  const normalizedFile: WorkflowRunsFile = {
    version: 1,
    runs: workflowRunsFile.runs.map(normalizeWorkflowRun).filter((run): run is WorkflowRun => run !== null)
  };

  await fs.mkdir(path.dirname(workflowRunsPath), { recursive: true });
  await fs.writeFile(`${workflowRunsPath}.tmp`, `${JSON.stringify(normalizedFile, null, 2)}\n`, "utf8");
  await fs.rename(`${workflowRunsPath}.tmp`, workflowRunsPath);
}

function normalizeWorkflowDefinition(value: unknown): WorkflowDefinition {
  const raw = isRecord(value) ? value : {};
  const now = new Date().toISOString();
  const id = getString(raw.id, randomUUID());
  const nodes = Array.isArray(raw.nodes) ? raw.nodes.map(normalizeWorkflowNode) : [];

  return {
    id,
    name: getString(raw.name, "Untitled workflow").slice(0, 120),
    description: getString(raw.description, "").slice(0, 400),
    active: typeof raw.active === "boolean" ? raw.active : false,
    nodes: nodes.length > 0 ? nodes : getDefaultNodes(id),
    edges: Array.isArray(raw.edges)
      ? raw.edges.map(normalizeWorkflowEdge).filter((edge): edge is WorkflowEdge => edge !== null)
      : [],
    createdAt: getString(raw.createdAt, now),
    updatedAt: getString(raw.updatedAt, now)
  };
}

function normalizeWorkflowNode(value: unknown): WorkflowNode {
  const raw = isRecord(value) ? value : {};
  const type = normalizeNodeType(raw.type);
  const position = isRecord(raw.position) ? raw.position : {};

  return {
    id: getString(raw.id, randomUUID()),
    type,
    name: getString(raw.name, getDefaultNodeName(type)).slice(0, 80),
    position: {
      x: getNumber(position.x, 0),
      y: getNumber(position.y, 0)
    },
    config: isRecord(raw.config) ? raw.config : {}
  };
}

function normalizeWorkflowEdge(value: unknown): WorkflowEdge | null {
  const raw = isRecord(value) ? value : {};
  const source = getString(raw.source, "");
  const target = getString(raw.target, "");

  if (!source || !target) {
    return null;
  }

  return {
    id: getString(raw.id, `${source}->${target}`),
    source,
    target
  };
}

function normalizeWorkflowRun(value: unknown): WorkflowRun | null {
  if (!isRecord(value)) {
    return null;
  }

  const workflowId = getString(value.workflowId, "");
  const workflowName = getString(value.workflowName, "");

  if (!workflowId || !workflowName) {
    return null;
  }

  const steps = Array.isArray(value.steps)
    ? value.steps.map(normalizeWorkflowRunStep).filter((step): step is WorkflowRunStep => step !== null)
    : [];

  return {
    id: getString(value.id, randomUUID()),
    workflowId,
    workflowName,
    mode: value.mode === "dry-run" ? "dry-run" : "run",
    status: value.status === "failed" ? "failed" : "success",
    startedAt: getString(value.startedAt, new Date().toISOString()),
    completedAt: getString(value.completedAt, new Date().toISOString()),
    durationMs: getNumber(value.durationMs, 0),
    steps,
    summary: isRecord(value.summary)
      ? {
          selectedProjects: getNumber(value.summary.selectedProjects, 0),
          succeeded: getNumber(value.summary.succeeded, 0),
          failed: getNumber(value.summary.failed, 0),
          skipped: getNumber(value.summary.skipped, 0),
          commands: getNumber(value.summary.commands, 0)
        }
      : summarizeRun(0, steps)
  };
}

function normalizeWorkflowRunStep(value: unknown): WorkflowRunStep | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    id: getString(value.id, randomUUID()),
    nodeId: getString(value.nodeId, ""),
    nodeName: getString(value.nodeName, ""),
    nodeType: normalizeNodeType(value.nodeType),
    status: value.status === "failed" ? "failed" : value.status === "skipped" ? "skipped" : "success",
    projectId: getNullableString(value.projectId),
    projectName: getNullableString(value.projectName),
    command: getNullableString(value.command),
    message: getString(value.message, ""),
    stdout: getString(value.stdout, ""),
    stderr: getString(value.stderr, ""),
    durationMs: getNumber(value.durationMs, 0)
  };
}

function getDefaultWorkflows(): WorkflowDefinition[] {
  const now = new Date().toISOString();
  const id = "workflow-default-fetch-pull";

  return [
    {
      id,
      name: "Fetch & pull preferiti",
      description: "Seleziona i repository preferiti, tiene solo quelli puliti, poi esegue fetch e pull ff-only.",
      active: false,
      nodes: getDefaultNodes(id),
      edges: [
        { id: "edge-trigger-select", source: `${id}-trigger`, target: `${id}-select` },
        { id: "edge-select-filter", source: `${id}-select`, target: `${id}-filter` },
        { id: "edge-filter-fetch", source: `${id}-filter`, target: `${id}-fetch` },
        { id: "edge-fetch-pull", source: `${id}-fetch`, target: `${id}-pull` },
        { id: "edge-pull-summary", source: `${id}-pull`, target: `${id}-summary` }
      ],
      createdAt: now,
      updatedAt: now
    }
  ];
}

function getDefaultNodes(id: string): WorkflowNode[] {
  return [
    {
      id: `${id}-trigger`,
      type: "trigger.manual",
      name: "Manual trigger",
      position: { x: 40, y: 160 },
      config: {}
    },
    {
      id: `${id}-select`,
      type: "repository.select",
      name: "Select repositories",
      position: { x: 280, y: 160 },
      config: { mode: "favorites", projectIds: [] }
    },
    {
      id: `${id}-filter`,
      type: "repository.filter",
      name: "Only clean",
      position: { x: 520, y: 160 },
      config: { clean: "clean", sync: "any", docker: "any" }
    },
    {
      id: `${id}-fetch`,
      type: "git.fetch",
      name: "Git fetch",
      position: { x: 760, y: 160 },
      config: {}
    },
    {
      id: `${id}-pull`,
      type: "git.pull",
      name: "Git pull",
      position: { x: 1000, y: 160 },
      config: { requireClean: true }
    },
    {
      id: `${id}-summary`,
      type: "output.summary",
      name: "Summary",
      position: { x: 1240, y: 160 },
      config: {}
    }
  ];
}

function normalizeNodeType(value: unknown): WorkflowNodeType {
  const nodeTypes: WorkflowNodeType[] = [
    "trigger.manual",
    "repository.select",
    "repository.filter",
    "git.fetch",
    "git.pull",
    "git.pullDevelop",
    "git.push",
    "docker.up",
    "docker.rebuild",
    "docker.stop",
    "terminal.command",
    "output.summary"
  ];

  return typeof value === "string" && nodeTypes.includes(value as WorkflowNodeType)
    ? (value as WorkflowNodeType)
    : "trigger.manual";
}

function getDefaultNodeName(type: WorkflowNodeType): string {
  switch (type) {
    case "trigger.manual":
      return "Manual trigger";
    case "repository.select":
      return "Select repositories";
    case "repository.filter":
      return "Filter repositories";
    case "git.fetch":
      return "Git fetch";
    case "git.pull":
      return "Git pull";
    case "git.pullDevelop":
      return "Pull develop";
    case "git.push":
      return "Git push";
    case "docker.up":
      return "Compose up";
    case "docker.rebuild":
      return "Compose rebuild";
    case "docker.stop":
      return "Compose stop";
    case "terminal.command":
      return "Terminal command";
    case "output.summary":
      return "Summary";
  }
}

function getWorkflowPath(): string {
  return path.join(getConfigDirectory(), "workflows.json");
}

function getWorkflowRunsPath(): string {
  return path.join(getConfigDirectory(), "workflow-runs.json");
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function getNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function getNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
