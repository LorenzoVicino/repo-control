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

export type ProjectDetailTab = "overview" | "git" | "branches" | "terminal" | "docker";

export type ProjectTone = {
  label: string;
  chipColor: "success" | "warning" | "secondary" | "info";
  borderColor: string;
  background: string;
};
