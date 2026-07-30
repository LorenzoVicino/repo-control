import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { runProjectCommand, runShellCommand } from "../lib/commandRunner.js";
import { readWorkflowRun } from "./workflow/store.js";
import type { WorkflowDraft, WorkflowExecutionContext } from "./workflow/types.js";
import {
  cancelWorkflowRun,
  createWorkflow,
  reconcileStaleWorkflowRuns,
  startWorkflowRun,
  WorkflowRunConflictError
} from "./workflowService.js";

const execFileAsync = promisify(execFile);
const TERMINAL_RUN_STATUSES = new Set(["success", "warning", "failed", "cancelled", "interrupted"]);

async function createRepository(repositoryPath: string): Promise<void> {
  await fs.mkdir(repositoryPath, { recursive: true });
  await execFileAsync("git", ["init", "--initial-branch=main"], { cwd: repositoryPath });
  await execFileAsync("git", ["config", "user.name", "Repo Control Tests"], { cwd: repositoryPath });
  await execFileAsync("git", ["config", "user.email", "tests@repo-control.local"], { cwd: repositoryPath });
  await fs.writeFile(path.join(repositoryPath, "README.md"), "# fixture\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: repositoryPath });
  await execFileAsync("git", ["commit", "-m", "Initial fixture"], { cwd: repositoryPath });
}

async function withTemporaryConfigAndRoot<T>(run: (context: WorkflowExecutionContext) => Promise<T>): Promise<T> {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-workflow-service-test-"));
  const configPath = path.join(temporaryRoot, "config");
  const workspacePath = path.join(temporaryRoot, "workspace");
  const previousConfigPath = process.env.REPO_CONTROL_CONFIG_DIR;

  await createRepository(path.join(workspacePath, "fixture-project"));
  process.env.REPO_CONTROL_CONFIG_DIR = configPath;

  const context: WorkflowExecutionContext = {
    getActiveRootPath: () => workspacePath,
    runProjectCommand,
    runShellCommand
  };

  try {
    return await run(context);
  } finally {
    if (previousConfigPath === undefined) delete process.env.REPO_CONTROL_CONFIG_DIR;
    else process.env.REPO_CONTROL_CONFIG_DIR = previousConfigPath;
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

function terminalWorkflowDraft(name: string, command: string): WorkflowDraft {
  return {
    name,
    description: "",
    active: true,
    nodes: [
      { id: "trigger", type: "trigger.manual", name: "Start", position: { x: 0, y: 0 }, config: {} },
      {
        id: "repositories",
        type: "repository.select",
        name: "Repositories",
        position: { x: 200, y: 0 },
        config: { mode: "all", projectIds: [] }
      },
      {
        id: "command",
        type: "terminal.command",
        name: "Command",
        position: { x: 400, y: 0 },
        config: { command }
      }
    ],
    edges: [
      { id: "edge-1", source: "trigger", target: "repositories" },
      { id: "edge-2", source: "repositories", target: "command" }
    ]
  };
}

async function waitForTerminalRun(runId: string) {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const run = await readWorkflowRun(runId);
    if (run && TERMINAL_RUN_STATUSES.has(run.status)) {
      return run;
    }
    await delay(25);
  }

  throw new Error(`Run ${runId} did not reach a terminal status in time`);
}

test("persists a pending run before the background execution finishes", async () => {
  await withTemporaryConfigAndRoot(async (context) => {
    const workflow = await createWorkflow(terminalWorkflowDraft("Pending visibility", "echo hi"));
    const run = await startWorkflowRun(workflow.id, context);

    assert.ok(run);
    assert.equal(["pending", "running"].includes(run.status), true);

    const persisted = await readWorkflowRun(run.id);
    assert.ok(persisted);
    assert.equal(persisted.id, run.id);

    await waitForTerminalRun(run.id);
  });
});

test("cancelling an active run kills the process and marks the run cancelled promptly", async () => {
  await withTemporaryConfigAndRoot(async (context) => {
    const workflow = await createWorkflow(terminalWorkflowDraft("Cancellable", "sleep 10"));
    const run = await startWorkflowRun(workflow.id, context);
    assert.ok(run);

    const startedAt = Date.now();
    const outcome = cancelWorkflowRun(run.id);
    assert.equal(outcome, "cancelled");

    const finalRun = await waitForTerminalRun(run.id);
    const elapsedMs = Date.now() - startedAt;

    assert.equal(finalRun.status, "cancelled");
    assert.equal(finalRun.statusMessage, "Cancelled by user");
    assert.ok(elapsedMs < 7_000, `expected cancellation well before the sleep finished, took ${elapsedMs}ms`);
  });
});

test("rejects a second concurrent run of the same workflow", async () => {
  await withTemporaryConfigAndRoot(async (context) => {
    const workflow = await createWorkflow(terminalWorkflowDraft("Concurrent", "sleep 2"));
    const first = await startWorkflowRun(workflow.id, context);
    assert.ok(first);

    await assert.rejects(
      () => startWorkflowRun(workflow.id, context),
      WorkflowRunConflictError
    );

    cancelWorkflowRun(first.id);
    await waitForTerminalRun(first.id);
  });
});

test("reconcileStaleWorkflowRuns marks leftover pending/running records as interrupted", async () => {
  await withTemporaryConfigAndRoot(async (context) => {
    const workflow = await createWorkflow(terminalWorkflowDraft("Interrupted", "sleep 10"));
    const run = await startWorkflowRun(workflow.id, context);
    assert.ok(run);

    // Simulate the in-memory AbortController registry being gone (server restart) by
    // reconciling immediately, before the background sleep would ever finish on its own.
    await reconcileStaleWorkflowRuns();

    const reconciled = await readWorkflowRun(run.id);
    assert.equal(reconciled?.status, "interrupted");
    assert.match(reconciled?.statusMessage ?? "", /restarted/);

    cancelWorkflowRun(run.id);
  });
});
