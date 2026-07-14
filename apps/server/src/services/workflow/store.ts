import { promises as fs } from "node:fs";
import path from "node:path";
import { getConfigDirectory } from "../../preferences.js";
import { getDefaultWorkflows, normalizeWorkflowDefinition, normalizeWorkflowRun } from "./schema.js";
import type {
  WorkflowFile,
  WorkflowRun,
  WorkflowRunsFile
} from "./types.js";

const MAX_WORKFLOW_RUNS = 100;

export async function readWorkflowFile(): Promise<WorkflowFile> {
  const content = await fs.readFile(getWorkflowPath(), "utf8").catch(() => null);

  if (!content) {
    return { version: 1, workflows: getDefaultWorkflows() };
  }

  try {
    const parsed = JSON.parse(content) as Partial<WorkflowFile>;
    return {
      version: 1,
      workflows: Array.isArray(parsed.workflows)
        ? parsed.workflows.map(normalizeWorkflowDefinition)
        : getDefaultWorkflows()
    };
  } catch {
    return { version: 1, workflows: getDefaultWorkflows() };
  }
}

export async function writeWorkflowFile(workflowFile: WorkflowFile): Promise<void> {
  const workflowPath = getWorkflowPath();
  const normalizedFile: WorkflowFile = {
    version: 1,
    workflows: workflowFile.workflows.map(normalizeWorkflowDefinition)
  };

  await writeJsonFile(workflowPath, normalizedFile);
}

export async function readWorkflowRunsFile(): Promise<WorkflowRunsFile> {
  const content = await fs.readFile(getWorkflowRunsPath(), "utf8").catch(() => null);

  if (!content) return { version: 1, runs: [] };

  try {
    const parsed = JSON.parse(content) as Partial<WorkflowRunsFile>;
    const runs = Array.isArray(parsed.runs)
      ? parsed.runs.map(normalizeWorkflowRun).filter((run): run is WorkflowRun => run !== null)
      : [];

    return { version: 1, runs: runs.slice(0, MAX_WORKFLOW_RUNS) };
  } catch {
    return { version: 1, runs: [] };
  }
}

export async function writeWorkflowRunsFile(workflowRunsFile: WorkflowRunsFile): Promise<void> {
  const normalizedFile: WorkflowRunsFile = {
    version: 1,
    runs: workflowRunsFile.runs
      .map(normalizeWorkflowRun)
      .filter((run): run is WorkflowRun => run !== null)
      .slice(0, MAX_WORKFLOW_RUNS)
  };

  await writeJsonFile(getWorkflowRunsPath(), normalizedFile);
}

export async function rememberWorkflowRun(run: WorkflowRun): Promise<void> {
  const runsFile = await readWorkflowRunsFile();
  await writeWorkflowRunsFile({
    version: 1,
    runs: [run, ...runsFile.runs].slice(0, MAX_WORKFLOW_RUNS)
  });
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(`${filePath}.tmp`, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(`${filePath}.tmp`, filePath);
}

function getWorkflowPath(): string {
  return path.join(getConfigDirectory(), "workflows.json");
}

function getWorkflowRunsPath(): string {
  return path.join(getConfigDirectory(), "workflow-runs.json");
}
