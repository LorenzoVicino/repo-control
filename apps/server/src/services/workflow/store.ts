import { randomUUID } from "node:crypto";
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
let workflowMutationQueue: Promise<void> = Promise.resolve();
let workflowRunMutationQueue: Promise<void> = Promise.resolve();

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

export function mutateWorkflowFile<T>(
  mutate: (workflowFile: WorkflowFile) => T | Promise<T>
): Promise<T> {
  const operation = workflowMutationQueue.then(async () => {
    const workflowFile = await readWorkflowFile();
    const result = await mutate(workflowFile);
    await writeWorkflowFile(workflowFile);
    return result;
  });

  workflowMutationQueue = operation.then(
    () => undefined,
    () => undefined
  );
  return operation;
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

function enqueueRunMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = workflowRunMutationQueue.then(operation);

  workflowRunMutationQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export function insertWorkflowRun(run: WorkflowRun): Promise<void> {
  return enqueueRunMutation(async () => {
    const runsFile = await readWorkflowRunsFile();
    await writeWorkflowRunsFile({
      version: 1,
      runs: [run, ...runsFile.runs].slice(0, MAX_WORKFLOW_RUNS)
    });
  });
}

export function updateWorkflowRun(
  runId: string,
  mutate: (run: WorkflowRun) => WorkflowRun
): Promise<WorkflowRun | null> {
  return enqueueRunMutation(async () => {
    const runsFile = await readWorkflowRunsFile();
    let updated: WorkflowRun | null = null;
    const nextRuns = runsFile.runs.map((run) => {
      if (run.id !== runId) return run;
      updated = mutate(run);
      return updated;
    });

    if (updated) {
      await writeWorkflowRunsFile({ version: 1, runs: nextRuns });
    }
    return updated;
  });
}

export async function readWorkflowRun(runId: string): Promise<WorkflowRun | null> {
  const runsFile = await readWorkflowRunsFile();
  return runsFile.runs.find((run) => run.id === runId) ?? null;
}

// Called once at server boot: a "pending"/"running" record left over from a previous
// process (crash, restart, kill) can never be resumed or cancelled, since the in-memory
// AbortController driving it is gone. Mark it "interrupted" instead of leaving it stuck.
export function reconcileStaleWorkflowRuns(): Promise<void> {
  return enqueueRunMutation(async () => {
    const runsFile = await readWorkflowRunsFile();
    const nextRuns = runsFile.runs.map((run) => {
      if (run.status !== "pending" && run.status !== "running") return run;
      return {
        ...run,
        status: "interrupted" as const,
        completedAt: new Date().toISOString(),
        statusMessage: "Interrupted because the server restarted before the run finished."
      };
    });

    await writeWorkflowRunsFile({ version: 1, runs: nextRuns });
  });
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.unlink(temporaryPath).catch(() => undefined);
  }
}

function getWorkflowPath(): string {
  return path.join(getConfigDirectory(), "workflows.json");
}

function getWorkflowRunsPath(): string {
  return path.join(getConfigDirectory(), "workflow-runs.json");
}
