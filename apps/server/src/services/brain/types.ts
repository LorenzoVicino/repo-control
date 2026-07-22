export type BrainTaskType = "feature" | "fix" | "refactor" | "chore" | "spike";
export type BrainTaskProfile = "lean" | "full" | "research";
export type BrainAgentProvider = "claude" | "codex" | "manual";
export type BrainTaskStatus =
  | "definition"
  | "requirements"
  | "design"
  | "breakdown"
  | "implementation"
  | "done";
export type BrainContentPhase = "requirements" | "design" | "breakdown";
export type BrainGatePhase = "definition" | BrainContentPhase | "implementation";

export type BrainPhaseState = {
  content: string;
  approvedAt: string | null;
};

export type BrainLogEntry = {
  id: string;
  kind: "note" | "fix" | "result";
  content: string;
  createdAt: string;
};

export type BrainDecision = {
  id: string;
  title: string;
  rationale: string;
  createdAt: string;
};

export type BrainRunCheck = {
  id: string;
  command: string;
  ok: boolean;
  exitCode: number | null;
  output: string;
  durationMs: number;
};

export type BrainTaskRun = {
  id: string;
  status: "succeeded" | "failed";
  prompt: string;
  response: string;
  error: string | null;
  claudeSessionId: string | null;
  specHash: string;
  checks: BrainRunCheck[];
  startedAt: string;
  completedAt: string;
};

export type BrainTaskPlanning = {
  profile: BrainTaskProfile;
  provider: BrainAgentProvider;
  brief: string;
  generatedAt: string | null;
  assumptions: string[];
};

export type BrainTask = {
  id: string;
  title: string;
  type: BrainTaskType;
  status: BrainTaskStatus;
  contextRepositoryPaths: string[];
  definition: {
    description: string;
    motivation: string;
  };
  requirements: BrainPhaseState;
  design: BrainPhaseState;
  breakdown: BrainPhaseState;
  verificationChecks: string[];
  planning: BrainTaskPlanning;
  implementation: {
    log: BrainLogEntry[];
    runs: BrainTaskRun[];
  };
  decisions: BrainDecision[];
  git: {
    branch: string | null;
    prUrl: string | null;
  };
  claudeSessionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BrainTasksResponse = {
  projectPath: string;
  projectName: string;
  remoteUrl: string | null;
  tasks: BrainTask[];
};

export type CreateBrainTaskInput = {
  title: string;
  type: BrainTaskType;
  contextRepositoryPaths?: string[];
  definition: {
    description: string;
    motivation: string;
  };
};

export type CreateApprovedBrainTaskInput = CreateBrainTaskInput & {
  requirements: string;
  design: string;
  breakdown: string;
  verificationChecks: string[];
  planning: BrainTaskPlanning;
  claudeSessionId?: string | null;
};

export type UpdateBrainTaskInput = {
  title?: string;
  type?: BrainTaskType;
  contextRepositoryPaths?: string[];
  definition?: Partial<BrainTask["definition"]>;
  phase?: BrainContentPhase;
  content?: string;
  verificationChecks?: string[];
  git?: Partial<BrainTask["git"]>;
  claudeSessionId?: string | null;
};

export type AppendBrainLogInput = {
  kind: BrainLogEntry["kind"];
  content: string;
};

export type AppendBrainDecisionInput = {
  title: string;
  rationale: string;
};

export type BrainFile = BrainTasksResponse & {
  version: 1;
};

export type RepositoryContext = {
  role: "primary" | "context";
  name: string;
  projectPath: string;
  available: boolean;
  remoteUrl: string | null;
  branch: string | null;
  upstream: string | null;
  isClean: boolean | null;
  staged: number;
  modified: number;
  untracked: number;
  conflicted: number;
  ahead: number;
  behind: number;
  recentCommits: string[];
};
