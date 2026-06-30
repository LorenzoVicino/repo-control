import { promises as fs } from "node:fs";
import type { Dirent } from "node:fs";
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

export async function scanProjects(rootPath: string): Promise<ProjectSummary[]> {
  const resolvedRoot = path.resolve(rootPath);
  const repoPaths = await findGitRepos(resolvedRoot);
  const projects = await Promise.all(repoPaths.map((repoPath) => readProjectSummary(repoPath, resolvedRoot)));

  return projects
    .filter((project): project is ProjectSummary => project !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function findGitRepos(rootPath: string): Promise<string[]> {
  const repositories: string[] = [];

  async function visit(currentPath: string): Promise<void> {
    let entries: Dirent[];

    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

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

async function readProjectSummary(repoPath: string, rootPath: string): Promise<ProjectSummary | null> {
  const git = simpleGit(repoPath);

  try {
    const [status, log, composeFiles] = await Promise.all([
      git.status(),
      git.log({ maxCount: 1 }),
      findComposeFiles(repoPath)
    ]);

    const latest = log.latest;

    return {
      id: Buffer.from(path.relative(rootPath, repoPath)).toString("base64url"),
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
