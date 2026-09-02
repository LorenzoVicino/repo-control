export type WorkflowNodeType =
  | "trigger.manual"
  | "input.text"
  | "repository.select"
  | "repository.filter"
  | "git.fetch"
  | "git.pull"
  | "git.pullBranch"
  | "git.push"
  | "docker.up"
  | "docker.rebuild"
  | "docker.stop"
  | "terminal.command"
  | "output.summary";

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  name: string;
  position: { x: number; y: number };
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
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
};

export type WorkflowDraft = Pick<WorkflowDefinition, "name" | "description" | "nodes" | "edges">;
export type WorkflowRunMode = "run" | "dry-run";
export type WorkflowRunInputs = Record<string, string>;
export type WorkflowRunStatus =
  | "pending"
  | "running"
  | "success"
  | "warning"
  | "failed"
  | "cancelled"
  | "interrupted";
export type WorkflowStepStatus = "success" | "failed" | "skipped" | "cancelled";

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
  startedAt?: string;
};

export type WorkflowRun = {
  id: string;
  workflowId: string;
  workflowName: string;
  mode: WorkflowRunMode;
  status: WorkflowRunStatus;
  startedAt: string;
  // Empty while the run is pending/running; set once the run reaches a terminal status.
  completedAt: string;
  durationMs: number;
  steps: WorkflowRunStep[];
  summary: {
    selectedProjects: number;
    succeeded: number;
    failed: number;
    skipped: number;
    commands: number;
  };
  statusMessage: string | null;
};

export type WorkflowListResponse = {
  workflows: WorkflowDefinition[];
};

export type WorkflowRunsResponse = {
  runs: WorkflowRun[];
};
