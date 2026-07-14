export type BrainTaskType = "feature" | "fix" | "refactor" | "chore" | "spike";
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
