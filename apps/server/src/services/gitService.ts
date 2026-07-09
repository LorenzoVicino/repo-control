import path from "node:path";
import { simpleGit } from "simple-git";
import type { StatusResult } from "simple-git";

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

export async function readGitDetails(projectPath: string): Promise<GitDetails> {
  const git = simpleGit(projectPath);
  const [status, localBranchesRaw, remoteBranchesRaw, stashListRaw] = await Promise.all([
    git.status(),
    git.raw(["branch", "--format=%(refname:short)|%(HEAD)|%(upstream:short)|%(upstream:track)", "--sort=refname"]),
    git.raw([
      "branch",
      "-r",
      "--format=%(refname:short)|%(HEAD)|%(upstream:short)|%(upstream:track)",
      "--sort=refname"
    ]),
    git.raw(["stash", "list", "--date=iso-strict", "--pretty=format:%gd%x1f%ci%x1f%gs%x1e"]).catch(() => "")
  ]);
  const current = status.current || "(detached)";

  return {
    status: {
      current,
      detached: status.detached,
      isClean: status.isClean(),
      tracking: status.tracking || null,
      ahead: status.ahead,
      behind: status.behind,
      files: getChangeGroups(status)
    },
    branches: {
      current,
      local: parseBranchRows(localBranchesRaw, false, status),
      remote: parseBranchRows(remoteBranchesRaw, true, status)
    },
    stashes: parseGitStashes(stashListRaw)
  };
}

export async function readGitActivity(projectPath: string, offset: number, limit: number): Promise<GitActivity> {
  const logOutput = await simpleGit(projectPath)
    .raw([
      "log",
      `--skip=${offset}`,
      `--max-count=${limit + 1}`,
      "--date=iso-strict",
      "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%D%x1f%s%x1e"
    ])
    .catch(() => "");
  const commits = parseGitActivity(logOutput);
  const hasMore = commits.length > limit;

  return {
    commits: commits.slice(0, limit),
    offset,
    limit,
    hasMore,
    nextOffset: hasMore ? offset + limit : null
  };
}

export async function getDirtyCheckoutMessage(projectPath: string): Promise<string | null> {
  const status = await simpleGit(projectPath).status();

  if (status.isClean()) {
    return null;
  }

  return "Checkout blocked: commit, stash, or discard local changes first.";
}

export function normalizeRemoteBranch(branch: string): string {
  return branch.replace(/^remotes\//, "");
}

export function isSafeGitRef(ref: string): boolean {
  return (
    /^[A-Za-z0-9._/-]+$/.test(ref) &&
    !ref.startsWith("-") &&
    !ref.startsWith("/") &&
    !ref.endsWith("/") &&
    !ref.endsWith(".") &&
    !ref.includes("//") &&
    !ref.includes("..") &&
    !ref.includes("@{") &&
    !ref.endsWith(".lock")
  );
}

export function isSafeGitPath(filePath: string): boolean {
  if (
    path.isAbsolute(filePath) ||
    filePath.includes("\0") ||
    filePath.includes("\n") ||
    filePath.includes("\r")
  ) {
    return false;
  }

  const segments = filePath.split(/[\\/]+/);
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

export function getGitPathArgs(filePath: string, previousPath: string | null | undefined): string[] {
  return ["--", ...[previousPath, filePath].filter((pathArg): pathArg is string => Boolean(pathArg))];
}

function parseGitActivity(output: string): GitActivityCommit[] {
  return output
    .split("\x1e")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [hash = "", shortHash = "", author = "", date = "", refs = "", message = ""] = row.split("\x1f");

      return {
        hash,
        shortHash,
        author,
        date,
        refs: parseGitRefs(refs),
        message
      };
    })
    .filter((commit) => commit.hash && commit.shortHash);
}

function parseGitRefs(refs: string): string[] {
  return refs
    .split(",")
    .map((ref) => ref.trim())
    .filter(Boolean)
    .map((ref) => ref.replace(/^HEAD -> /, ""))
    .slice(0, 4);
}

function getChangeGroups(status: StatusResult): GitChangeGroups {
  return {
    staged: uniqueGitFileChanges(status.staged.map((filePath) => createGitFileChange(filePath, "staged"))),
    unstaged: uniqueGitFileChanges([
      ...status.modified.map((filePath) => createGitFileChange(filePath, "modified")),
      ...status.deleted.map((filePath) => createGitFileChange(filePath, "deleted")),
      ...status.renamed.map((file) => createGitFileChange(file.to, "renamed", file.from)),
      ...status.not_added.map((filePath) => createGitFileChange(filePath, "untracked")),
      ...status.conflicted.map((filePath) => createGitFileChange(filePath, "conflicted"))
    ])
  };
}

function createGitFileChange(pathName: string, status: GitFileStatus, previousPath: string | null = null): GitFileChange {
  return {
    path: pathName,
    previousPath,
    status,
    label: getGitFileStatusLabel(status)
  };
}

function getGitFileStatusLabel(status: GitFileStatus): string {
  switch (status) {
    case "staged":
      return "staged";
    case "modified":
      return "modified";
    case "deleted":
      return "deleted";
    case "renamed":
      return "renamed";
    case "untracked":
      return "untracked";
    case "conflicted":
      return "conflict";
  }
}

function uniqueGitFileChanges(files: GitFileChange[]): GitFileChange[] {
  const seen = new Set<string>();
  const uniqueFiles: GitFileChange[] = [];

  for (const file of files) {
    const key = `${file.previousPath ?? ""}\x1f${file.path}\x1f${file.status}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueFiles.push(file);
  }

  return uniqueFiles.sort((left, right) => getGitFileDisplayPath(left).localeCompare(getGitFileDisplayPath(right)));
}

function getGitFileDisplayPath(file: GitFileChange): string {
  return file.previousPath ? `${file.previousPath} -> ${file.path}` : file.path;
}

function parseGitStashes(output: string): GitStashEntry[] {
  return output
    .split("\x1e")
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [ref = "", date = "", message = ""] = row.split("\x1f");

      return {
        ref,
        index: Number(ref.match(/stash@\{(\d+)\}/)?.[1] ?? 0),
        date,
        message
      };
    })
    .filter((stash) => stash.ref.length > 0);
}

function parseBranchRows(output: string, remote: boolean, status: StatusResult): GitBranchInfo[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", head = "", upstream = "", track = ""] = line.split("|");
      const sync = parseTrack(track);
      const isCurrent = head === "*";

      return {
        name,
        current: isCurrent,
        remote,
        upstream: upstream || null,
        ahead: isCurrent ? status.ahead : sync.ahead,
        behind: isCurrent ? status.behind : sync.behind
      };
    })
    .filter((branch) => branch.name.length > 0 && branch.name !== "origin/HEAD");
}

function parseTrack(track: string): { ahead: number; behind: number } {
  return {
    ahead: Number(track.match(/ahead (\d+)/)?.[1] ?? 0),
    behind: Number(track.match(/behind (\d+)/)?.[1] ?? 0)
  };
}
