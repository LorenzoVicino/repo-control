import { randomUUID } from "node:crypto";
import type {
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeType,
  WorkflowRun,
  WorkflowRunStep,
  WorkflowRunSummary
} from "./types.js";
import {
  getNullableString,
  getNumber,
  getString,
  isRecord
} from "./value.js";

export function normalizeWorkflowDefinition(value: unknown): WorkflowDefinition {
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

export function normalizeWorkflowRun(value: unknown): WorkflowRun | null {
  if (!isRecord(value)) return null;

  const workflowId = getString(value.workflowId, "");
  const workflowName = getString(value.workflowName, "");

  if (!workflowId || !workflowName) return null;

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
      : summarizeSteps(0, steps)
  };
}

export function getDefaultWorkflows(): WorkflowDefinition[] {
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

  if (!source || !target) return null;

  return {
    id: getString(raw.id, `${source}->${target}`),
    source,
    target
  };
}

function normalizeWorkflowRunStep(value: unknown): WorkflowRunStep | null {
  if (!isRecord(value)) return null;

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
    "input.text",
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
  const names: Record<WorkflowNodeType, string> = {
    "trigger.manual": "Manual trigger",
    "input.text": "Text input",
    "repository.select": "Select repositories",
    "repository.filter": "Filter repositories",
    "git.fetch": "Git fetch",
    "git.pull": "Git pull",
    "git.pullDevelop": "Pull develop",
    "git.push": "Git push",
    "docker.up": "Compose up",
    "docker.rebuild": "Compose rebuild",
    "docker.stop": "Compose stop",
    "terminal.command": "Terminal command",
    "output.summary": "Summary"
  };

  return names[type];
}

function summarizeSteps(selectedProjects: number, steps: WorkflowRunStep[]): WorkflowRunSummary {
  return {
    selectedProjects,
    succeeded: steps.filter((step) => step.status === "success").length,
    failed: steps.filter((step) => step.status === "failed").length,
    skipped: steps.filter((step) => step.status === "skipped").length,
    commands: steps.filter((step) => step.command).length
  };
}
