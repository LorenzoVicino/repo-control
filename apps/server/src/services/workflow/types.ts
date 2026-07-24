import type { CommandRunner, ShellCommandRunner } from "../../lib/commandRunner.js";

export type WorkflowNodeType =
  | "trigger.manual"
  | "input.text"
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
export type WorkflowRunInputs = Record<string, string>;
export type WorkflowRunStatus = "success" | "warning" | "failed";
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
  runShellCommand: ShellCommandRunner;
};

export type WorkflowFile = {
  version: 1;
  workflows: WorkflowDefinition[];
};

export type WorkflowRunsFile = {
  version: 1;
  runs: WorkflowRun[];
};

export type WorkflowDraft = {
  name?: unknown;
  description?: unknown;
  active?: unknown;
  nodes?: unknown;
  edges?: unknown;
};
