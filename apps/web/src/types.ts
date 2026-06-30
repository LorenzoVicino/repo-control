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

export type GitChangeGroups = {
  staged: string[];
  modified: string[];
  deleted: string[];
  renamed: string[];
  untracked: string[];
  conflicted: string[];
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
};

export type ViewMode = "map" | "table";
export type ColorMode = "light" | "dark";
export type ProjectDetailTab = "changes" | "branches" | "terminal";

export type ProjectTone = {
  label: string;
  chipColor: "success" | "warning" | "secondary" | "info";
  borderColor: string;
  background: string;
};
