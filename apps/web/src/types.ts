export type ProjectSummary = {
  id: string;
  name: string;
  path: string;
  branch: string;
  isClean: boolean;
  staged: number;
  modified: number;
  untracked: number;
  ahead: number;
  behind: number;
  upstream: string | null;
  lastCommit: {
    hash: string;
    message: string;
    date: string;
    author: string;
  } | null;
  hasDockerCompose: boolean;
};

export type ProjectsResponse = {
  root: string;
  projects: ProjectSummary[];
};

export type DockerContainer = {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  runningFor: string;
  composeProject: string | null;
  composeService: string | null;
  composeWorkingDir: string | null;
};

export type DockerContainerGroup = {
  id: string;
  name: string;
  composeProject: string | null;
  workingDir: string | null;
  containers: DockerContainer[];
};

export type DockerContainersResponse = {
  ok: boolean;
  containers: DockerContainer[];
  groups: DockerContainerGroup[];
  checkedAt: string;
  error: string | null;
};

export type UserPreferences = {
  favoriteProjectIds: string[];
};

export type CommandResult = {
  ok: boolean;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  output: string;
  durationMs: number;
};

export type AppUpdateResult = CommandResult & {
  restartScheduled: boolean;
};

export type AppUpdateStatus = {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  checkedAt: string;
  error: string | null;
};

export type GitFileStatus = "staged" | "modified" | "deleted" | "renamed" | "untracked" | "conflicted";

export type GitFileChange = {
  path: string;
  previousPath: string | null;
  status: GitFileStatus;
  label: string;
};

export type GitChangeGroups = {
  staged: GitFileChange[];
  unstaged: GitFileChange[];
};

export type GitBranchInfo = {
  name: string;
  current: boolean;
  remote: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
};

export type GitDetails = {
  status: {
    current: string;
    detached: boolean;
    isClean: boolean;
    tracking: string | null;
    ahead: number;
    behind: number;
    files: GitChangeGroups;
  };
  branches: {
    current: string;
    local: GitBranchInfo[];
    remote: GitBranchInfo[];
  };
  stashes: GitStashEntry[];
};

export type GitStashEntry = {
  ref: string;
  index: number;
  date: string;
  message: string;
};

export type GitActivityCommit = {
  hash: string;
  shortHash: string;
  author: string;
  date: string;
  refs: string[];
  message: string;
};

export type GitActivity = {
  commits: GitActivityCommit[];
  offset: number;
  limit: number;
  hasMore: boolean;
  nextOffset: number | null;
};

export type ViewMode = "map" | "table";
export type ColorMode = "light" | "dark";
export type ProjectDetailTab = "git" | "branches" | "terminal" | "docker" | "deploy";

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

export type ProjectTone = {
  label: string;
  chipColor: "success" | "warning" | "secondary" | "info";
  borderColor: string;
  background: string;
};
