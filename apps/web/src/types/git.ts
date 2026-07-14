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
