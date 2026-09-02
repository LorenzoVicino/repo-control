import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  insertWorkflowRun,
  mutateWorkflowFile,
  readWorkflowFile,
  readWorkflowRun,
  readWorkflowRunsFile,
  updateWorkflowRun
} from "./store.js";
import type { WorkflowDefinition, WorkflowRun } from "./types.js";

async function withTemporaryConfig<T>(run: (configPath: string) => Promise<T>): Promise<T> {
  const configPath = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-workflow-store-test-"));
  const previousConfigPath = process.env.REPO_CONTROL_CONFIG_DIR;
  process.env.REPO_CONTROL_CONFIG_DIR = configPath;

  try {
    return await run(configPath);
  } finally {
    if (previousConfigPath === undefined) delete process.env.REPO_CONTROL_CONFIG_DIR;
    else process.env.REPO_CONTROL_CONFIG_DIR = previousConfigPath;
    await fs.rm(configPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

function createWorkflow(id: string): WorkflowDefinition {
  return {
    id,
    name: id,
    description: "",
    nodes: [{ id: `${id}-trigger`, type: "trigger.manual", name: "Start", position: { x: 0, y: 0 }, config: {} }],
    edges: [],
    createdAt: "2026-08-14T00:00:00.000Z",
    updatedAt: "2026-08-14T00:00:00.000Z"
  };
}

function createRun(id: string, status: WorkflowRun["status"] = "pending"): WorkflowRun {
  return {
    id,
    workflowId: "workflow",
    workflowName: "Workflow",
    mode: "run",
    status,
    startedAt: "2026-08-14T00:00:00.000Z",
    completedAt: status === "pending" || status === "running" ? "" : "2026-08-14T00:01:00.000Z",
    durationMs: 0,
    steps: [],
    summary: { selectedProjects: 0, succeeded: 0, failed: 0, skipped: 0, commands: 0 },
    statusMessage: null
  };
}

test("serializes concurrent workflow and run mutations without losing records", async () => {
  await withTemporaryConfig(async () => {
    await Promise.all([
      mutateWorkflowFile((file) => file.workflows.push(createWorkflow("workflow-a"))),
      mutateWorkflowFile((file) => file.workflows.push(createWorkflow("workflow-b")))
    ]);
    const workflowIds = (await readWorkflowFile()).workflows.map((workflow) => workflow.id);
    assert.equal(workflowIds.includes("workflow-a"), true);
    assert.equal(workflowIds.includes("workflow-b"), true);

    await Promise.all([insertWorkflowRun(createRun("run-a")), insertWorkflowRun(createRun("run-b"))]);
    await Promise.all([
      updateWorkflowRun("run-a", (run) => ({ ...run, status: "success" })),
      updateWorkflowRun("run-b", (run) => ({ ...run, status: "failed" }))
    ]);

    assert.equal((await readWorkflowRun("run-a"))?.status, "success");
    assert.equal((await readWorkflowRun("run-b"))?.status, "failed");
  });
});

test("retains only the newest 100 workflow runs under concurrent inserts", async () => {
  await withTemporaryConfig(async () => {
    await Promise.all(Array.from({ length: 125 }, (_, index) => insertWorkflowRun(createRun(`run-${index}`))));

    const runs = (await readWorkflowRunsFile()).runs;
    assert.equal(runs.length, 100);
    assert.equal(new Set(runs.map((run) => run.id)).size, 100);
    assert.equal(runs[0]?.id, "run-124");
    assert.equal(runs.at(-1)?.id, "run-25");
  });
});

test("recovers safely from corrupted workflow persistence files", async () => {
  await withTemporaryConfig(async (configPath) => {
    await fs.writeFile(path.join(configPath, "workflows.json"), "{broken", "utf8");
    await fs.writeFile(path.join(configPath, "workflow-runs.json"), "not-json", "utf8");

    const workflowFile = await readWorkflowFile();
    const runsFile = await readWorkflowRunsFile();
    assert.equal(workflowFile.workflows.length, 1);
    assert.equal(runsFile.runs.length, 0);
  });
});
