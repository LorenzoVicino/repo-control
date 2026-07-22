export type BrainTaskType = "feature" | "fix" | "refactor" | "chore" | "spike";
export type BrainTaskProfile = "lean" | "full" | "research";
export type BrainAgentProvider = "claude" | "codex" | "manual";
export type BrainTaskStatus = "definition" | "requirements" | "design" | "breakdown" | "implementation" | "done";
export type BrainContentPhase = "requirements" | "design" | "breakdown";
export type BrainGatePhase = "definition" | BrainContentPhase | "implementation";

export type BrainPhaseState = {
  content: string;
  approvedAt: string | null;
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

export type TaskPlanningQuestion = {
  id: string;
  question: string;
  options: string[];
  recommendedOption: string | null;
};

export type TaskPlanDraft = {
  provider: "claude";
  providerLabel: string;
  sessionId: string | null;
  generatedAt: string;
  title: string;
  type: BrainTaskType;
  profile: BrainTaskProfile;
  description: string;
  motivation: string;
  requirements: string;
  design: string;
  breakdown: string;
  checks: string[];
  assumptions: string[];
  questions: TaskPlanningQuestion[];
};

export type BrainTask = {
  id: string;
  title: string;
  type: BrainTaskType;
  status: BrainTaskStatus;
  contextRepositoryPaths: string[];
  definition: { description: string; motivation: string };
  requirements: BrainPhaseState;
  design: BrainPhaseState;
  breakdown: BrainPhaseState;
  verificationChecks: string[];
  planning: BrainTaskPlanning;
  implementation: {
    log: Array<{ id: string; kind: "note" | "fix" | "result"; content: string; createdAt: string }>;
    runs: BrainTaskRun[];
  };
  decisions: Array<{ id: string; title: string; rationale: string; createdAt: string }>;
  git: { branch: string | null; prUrl: string | null };
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

export type BrainContextPreview = {
  content: string;
  specHash: string;
  generatedAt: string;
};
