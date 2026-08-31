import { promises as fs } from "node:fs";
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

const MAX_GIT_DIFF_LENGTH = 60_000;

export async function readGitDetails(projectPath: string): Promise<GitDetails> {
  const git = simpleGit(projectPath);
  const [
    status,
    localBranchesRaw,
    remoteBranchesRaw,
    stashListRaw,
    stagedDiffRaw,
    unstagedDiffRaw,
    mergedLocalRaw,
    mergedRemoteRaw,
    defaultBranchRaw
  ] = await Promise.all([
    git.status(),
    git.raw(["branch", `--format=${getBranchFormat()}`, "--sort=refname"]),
    git.raw([
      "branch",
      "-r",
      `--format=${getBranchFormat()}`,
      "--sort=refname"
    ]),
    git.raw(["stash", "list", "--date=iso-strict", "--pretty=format:%gd%x1f%ci%x1f%gs%x1e"]).catch(() => ""),
    git.raw(["diff", "--cached", "--numstat"]).catch(() => ""),
    git.raw(["diff", "--numstat"]).catch(() => ""),
    git.raw(["branch", "--format=%(refname:short)", "--merged"]).catch(() => ""),
    git.raw(["branch", "-r", "--format=%(refname:short)", "--merged"]).catch(() => ""),
    git.raw(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]).catch(() => "")
  ]);
  const current = status.detached ? "(detached)" : status.current || "(detached)";
  const files = getChangeGroups(status);
  const mergedLocalBranches = parseNameSet(mergedLocalRaw);
  const mergedRemoteBranches = parseNameSet(mergedRemoteRaw);

  return {
    status: {
      current,
      detached: status.detached,
      isClean: status.isClean(),
      tracking: status.tracking || null,
      ahead: status.ahead,
      behind: status.behind,
      files,
      diff: {
        staged: parseDiffSummary(stagedDiffRaw, files.staged.length, 0),
        unstaged: parseDiffSummary(unstagedDiffRaw, files.unstaged.length, status.not_added.length)
      }
    },
    branches: {
      current,
      defaultBranch: normalizeDefaultBranch(defaultBranchRaw),
      local: parseBranchRows(localBranchesRaw, false, status, mergedLocalBranches),
      remote: parseBranchRows(remoteBranchesRaw, true, status, mergedRemoteBranches)
    },
    stashes: parseGitStashes(stashListRaw)
  };
}

export async function readGitFileDiff(
  projectPath: string,
  filePath: string,
  previousPath: string | null,
  staged: boolean
): Promise<GitFileDiff> {
  const git = simpleGit(projectPath);
  const pathArgs = getGitPathArgs(filePath, previousPath);
  const args = staged
    ? ["diff", "--cached", "--no-ext-diff", "--unified=3", ...pathArgs]
    : ["diff", "--no-ext-diff", "--unified=3", ...pathArgs];
  let patch = await git.raw(args).catch(() => "");
  let binary = /Binary files .* differ|GIT binary patch/.test(patch);

  if (!patch && !staged) {
    const untrackedContent = await readUntrackedFile(projectPath, filePath);
    patch = untrackedContent.patch;
    binary = untrackedContent.binary;
  }

  const { additions, deletions } = countPatchChanges(patch);
  const truncated = patch.length > MAX_GIT_DIFF_LENGTH;

  return {
    path: filePath,
    previousPath,
    staged,
    patch: truncated ? `${patch.slice(0, MAX_GIT_DIFF_LENGTH)}\n… diff truncated …` : patch,
    additions,
    deletions,
    binary,
    truncated
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
    path.win32.isAbsolute(filePath) ||
    filePath.includes("\0") ||
    filePath.includes("\n") ||
    filePath.includes("\r")
  ) {
    return false;
  }

  const segments = filePath.split(/[\\/]/);
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

function parseBranchRows(
  output: string,
  remote: boolean,
  status: StatusResult,
  mergedBranches: Set<string>
): GitBranchInfo[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name = "", head = "", upstream = "", track = "", hash = "", author = "", date = "", ...subjectParts] =
        line.split("\x1f");
      const sync = parseTrack(track);
      const isCurrent = head === "*";
      const message = subjectParts.join("\x1f");

      return {
        name,
        current: isCurrent,
        remote,
        upstream: upstream || null,
        ahead: isCurrent ? status.ahead : sync.ahead,
        behind: isCurrent ? status.behind : sync.behind,
        merged: mergedBranches.has(name),
        lastCommit: hash
          ? { hash, message, date, author }
          : null
      };
    })
    .filter((branch) => branch.name.length > 0 && branch.name !== "origin/HEAD");
}

function getBranchFormat(): string {
  return [
    "%(refname:short)",
    "%(HEAD)",
    "%(upstream:short)",
    "%(upstream:track)",
    "%(objectname:short)",
    "%(authorname)",
    "%(authordate:iso-strict)",
    "%(subject)"
  ].join("\x1f");
}

function parseNameSet(output: string): Set<string> {
  return new Set(output.split("\n").map((name) => name.trim()).filter(Boolean));
}

function normalizeDefaultBranch(output: string): string | null {
  const branch = output.trim();
  return branch ? branch.replace(/^origin\//, "") : null;
}

function parseDiffSummary(
  output: string,
  fileCount: number,
  untrackedFiles: number
): GitDiffSummary {
  let additions = 0;
  let deletions = 0;
  let binaryFiles = 0;

  for (const row of output.split("\n").map((line) => line.trim()).filter(Boolean)) {
    const [added = "0", deleted = "0"] = row.split("\t");
    if (added === "-" || deleted === "-") {
      binaryFiles += 1;
      continue;
    }
    additions += Number(added) || 0;
    deletions += Number(deleted) || 0;
  }

  return { files: fileCount, additions, deletions, binaryFiles, untrackedFiles };
}

async function readUntrackedFile(
  projectPath: string,
  filePath: string
): Promise<{ patch: string; binary: boolean }> {
  const absolutePath = path.resolve(projectPath, filePath);
  const relativePath = path.relative(projectPath, absolutePath);

  if (!isSafeGitPath(relativePath)) {
    return { patch: "", binary: false };
  }

  const content = await fs.readFile(absolutePath).catch(() => null);
  if (!content) return { patch: "", binary: false };
  if (content.includes(0)) {
    return { patch: `Binary file ${filePath}`, binary: true };
  }

  const text = content.toString("utf8");
  const lines = text.split("\n");
  return {
    binary: false,
    patch: [
      `diff --git a/${filePath} b/${filePath}`,
      "new file mode 100644",
      "--- /dev/null",
      `+++ b/${filePath}`,
      `@@ -0,0 +1,${lines.length} @@`,
      ...lines.map((line) => `+${line}`)
    ].join("\n")
  };
}

function countPatchChanges(patch: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;

  for (const line of patch.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }

  return { additions, deletions };
}

function parseTrack(track: string): { ahead: number; behind: number } {
  return {
    ahead: Number(track.match(/ahead (\d+)/)?.[1] ?? 0),
    behind: Number(track.match(/behind (\d+)/)?.[1] ?? 0)
  };
}
