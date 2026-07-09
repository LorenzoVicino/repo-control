import { promises as fs } from "node:fs";
import path from "node:path";

export type ProjectResolver = {
  getActiveRootPath: () => string;
  setActiveRootPath: (rootPath: string) => void;
  resolveProjectPath: (id: string) => Promise<string>;
};

export function createProjectResolver(initialRootInput: string): ProjectResolver {
  let activeRootPath = resolveRootInput(initialRootInput);

  return {
    getActiveRootPath: () => activeRootPath,
    setActiveRootPath: (rootPath) => {
      activeRootPath = rootPath;
    },
    resolveProjectPath: (id) => resolveProjectPath(activeRootPath, id)
  };
}

export async function resolveProjectPath(activeRootPath: string, id: string): Promise<string> {
  const decodedRelPath = Buffer.from(id, "base64url").toString("utf8");
  const projectPath = path.resolve(activeRootPath, decodedRelPath);
  const relativePath = path.relative(activeRootPath, projectPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Project path is outside configured root");
  }

  await fs.access(path.join(projectPath, ".git"));
  return projectPath;
}

export function resolveRootInput(rootInput: string): string {
  if (rootInput === "~") {
    return path.resolve(process.env.HOME ?? process.cwd());
  }

  if (rootInput.startsWith("~/")) {
    return path.resolve(process.env.HOME ?? process.cwd(), rootInput.slice(2));
  }

  return path.resolve(rootInput);
}

export async function assertComposeProject(projectPath: string): Promise<void> {
  const composeFiles = ["compose.yml", "compose.yaml", "docker-compose.yml", "docker-compose.yaml"];
  const checks = await Promise.all(
    composeFiles.map(async (fileName) => {
      try {
        await fs.access(path.join(projectPath, fileName));
        return true;
      } catch {
        return false;
      }
    })
  );

  if (!checks.some(Boolean)) {
    throw new Error("No Docker Compose file found for this project");
  }
}
