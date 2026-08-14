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
  merged: boolean;
  lastCommit: {
    hash: string;
    message: string;
    date: string;
    author: string;
  } | null;
};

export type GitDiffSummary = {
  files: number;
  additions: number;
  deletions: number;
  binaryFiles: number;
  untrackedFiles: number;
};

export type GitFileDiff = {
  path: string;
  previousPath: string | null;
  staged: boolean;
  patch: string;
  additions: number;
  deletions: number;
  binary: boolean;
  truncated: boolean;
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
    diff: {
      staged: GitDiffSummary;
      unstaged: GitDiffSummary;
    };
  };
  branches: {
    current: string;
    defaultBranch: string | null;
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
