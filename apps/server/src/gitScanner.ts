import { promises as fs } from "node:fs";
import path from "node:path";
import { simpleGit } from "simple-git";

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

const IGNORED_DIRS = new Set([
  ".cache",
  ".git",
  ".idea",
  ".next",
  ".turbo",
  ".venv",
  "bin",
  "build",
  "dist",
  "node_modules",
  "out",
  "target"
]);
const PROJECT_SCAN_CONCURRENCY = 8;
const DEFAULT_GIT_COMMAND_TIMEOUT_MS = 12_000;
const DEFAULT_DIRECTORY_READ_TIMEOUT_MS = 4_000;

export type ProjectScanOptions = {
  signal?: AbortSignal;
  gitCommandTimeoutMs?: number;
  directoryReadTimeoutMs?: number;
};

export async function scanProjects(
  rootPath: string,
  options: ProjectScanOptions = {}
): Promise<ProjectSummary[]> {
  const resolvedRoot = path.resolve(rootPath);
  const repoPaths = await findGitRepos(resolvedRoot, options);
  const projects = await mapWithConcurrency(
    repoPaths,
    PROJECT_SCAN_CONCURRENCY,
    (repoPath) => readProjectSummary(repoPath, resolvedRoot, options),
    options.signal
  );

  return projects
    .filter((project): project is ProjectSummary => project !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function findGitRepos(
  rootPath: string,
  options: ProjectScanOptions
): Promise<string[]> {
  const repositories: string[] = [];
  const directoryReadTimeoutMs = options.directoryReadTimeoutMs
    ?? DEFAULT_DIRECTORY_READ_TIMEOUT_MS;

  async function visit(currentPath: string): Promise<void> {
    if (options.signal?.aborted) return;

    const entries = await settleWithin(
      fs.readdir(currentPath, { withFileTypes: true }),
      directoryReadTimeoutMs,
      options.signal
    ).catch(() => null);
    if (!entries || options.signal?.aborted) return;

    if (entries.some((entry) => entry.name === ".git")) {
      repositories.push(currentPath);
    }

    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && !IGNORED_DIRS.has(entry.name))
        .map((entry) => visit(path.join(currentPath, entry.name)))
    );
  }

  await visit(rootPath);
  return repositories;
}

export async function readProjectSummary(
  repoPath: string,
  rootPath: string,
  options: ProjectScanOptions = {}
): Promise<ProjectSummary | null> {
  if (options.signal?.aborted) return null;

  const git = simpleGit(repoPath, {
    timeout: {
      block: options.gitCommandTimeoutMs ?? DEFAULT_GIT_COMMAND_TIMEOUT_MS,
      stdErr: false,
      stdOut: false
    },
    ...(options.signal ? { abort: options.signal } : {})
  });

  try {
    const [status, log, composeFiles] = await Promise.all([
      git.status(),
      git.log({ maxCount: 1 }),
      findComposeFiles(repoPath)
    ]);

    const latest = log.latest;

    const relativeRepoPath = path.relative(rootPath, repoPath) || ".";

    return {
      id: Buffer.from(relativeRepoPath).toString("base64url"),
      name: path.basename(repoPath),
      path: repoPath,
      branch: status.current || "(detached)",
      isClean: status.isClean(),
      staged: status.staged.length,
      modified: status.modified.length + status.deleted.length + status.renamed.length,
      untracked: status.not_added.length,
      ahead: status.ahead,
      behind: status.behind,
      upstream: status.tracking || null,
      lastCommit: latest
        ? {
            hash: latest.hash.slice(0, 8),
            message: latest.message,
            date: latest.date,
            author: latest.author_name
          }
        : null,
      hasDockerCompose: composeFiles.length > 0
    };
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapItem: (item: T) => Promise<R>,
  signal?: AbortSignal
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length && !signal?.aborted) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      results[itemIndex] = await mapItem(items[itemIndex]);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return signal?.aborted
    ? results.slice(0, nextIndex).filter((result): result is R => result !== undefined)
    : results;
}

function settleWithin<T>(
  operation: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Project scan cancelled"));
      return;
    }

    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(signal?.reason ?? new Error("Project scan cancelled")));
    const timeout = setTimeout(
      () => finish(() => reject(new Error("Filesystem operation timed out"))),
      timeoutMs
    );
    timeout.unref();

    signal?.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => finish(() => resolve(value)),
      (error) => finish(() => reject(error))
    );
  });
}

async function findComposeFiles(repoPath: string): Promise<string[]> {
  const candidates = ["compose.yml", "compose.yaml", "docker-compose.yml", "docker-compose.yaml"];
  const results = await Promise.all(
    candidates.map(async (fileName) => {
      const fullPath = path.join(repoPath, fileName);

      try {
        await fs.access(fullPath);
        return fullPath;
      } catch {
        return null;
      }
    })
  );

  return results.filter((file): file is string => file !== null);
}
