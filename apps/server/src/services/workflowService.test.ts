import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { runProjectCommand, runShellCommand } from "../lib/commandRunner.js";
import type { CommandResult } from "../lib/commandRunner.js";
import { readWorkflowRun } from "./workflow/store.js";
import type { WorkflowDraft, WorkflowExecutionContext } from "./workflow/types.js";
import {
  cancelWorkflowRun,
  createWorkflow,
  executeDryRun,
  reconcileStaleWorkflowRuns,
  startWorkflowRun,
  updateWorkflow,
  WorkflowRunConflictError
} from "./workflowService.js";

const execFileAsync = promisify(execFile);
const TERMINAL_RUN_STATUSES = new Set(["success", "warning", "failed", "cancelled", "interrupted"]);
const LONG_RUNNING_COMMAND = 'node -e "setTimeout(() => {}, 10000)"';

async function createRepository(repositoryPath: string): Promise<void> {
  await fs.mkdir(repositoryPath, { recursive: true });
  await execFileAsync("git", ["init", "--initial-branch=main"], { cwd: repositoryPath });
  await execFileAsync("git", ["config", "user.name", "Repo Control Tests"], { cwd: repositoryPath });
  await execFileAsync("git", ["config", "user.email", "tests@repo-control.local"], { cwd: repositoryPath });
  await fs.writeFile(path.join(repositoryPath, "README.md"), "# fixture\n", "utf8");
  await execFileAsync("git", ["add", "."], { cwd: repositoryPath });
  await execFileAsync("git", ["commit", "-m", "Initial fixture"], { cwd: repositoryPath });
}

async function withTemporaryConfigAndRoot<T>(
  run: (context: WorkflowExecutionContext) => Promise<T>,
  repositoryNames: string[] = ["fixture-project"]
): Promise<T> {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-workflow-service-test-"));
  const configPath = path.join(temporaryRoot, "config");
  const workspacePath = path.join(temporaryRoot, "workspace");
  const previousConfigPath = process.env.REPO_CONTROL_CONFIG_DIR;

  for (const repositoryName of repositoryNames) {
    await createRepository(path.join(workspacePath, repositoryName));
  }
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
    await fs.rm(temporaryRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

function terminalWorkflowDraft(name: string, command: string): WorkflowDraft {
  return {
    name,
    description: "",
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

function inputTerminalWorkflowDraft(name: string): WorkflowDraft {
  const draft = terminalWorkflowDraft(name, "echo {{inputs.message}}");
  const nodes = draft.nodes as Array<Record<string, unknown>>;
  const edges = draft.edges as Array<Record<string, unknown>>;

  nodes.splice(1, 0, {
    id: "message",
    type: "input.text",
    name: "Release message",
    position: { x: 100, y: 0 },
    config: { key: "message", label: "Release message", required: true, defaultValue: "" }
  });
  edges.splice(
    0,
    edges.length,
    { id: "edge-input-1", source: "trigger", target: "message" },
    { id: "edge-input-2", source: "message", target: "repositories" },
    { id: "edge-input-3", source: "repositories", target: "command" }
  );
  return draft;
}

function successfulCommandResult(command: string, stdout = "ok\n"): CommandResult {
  return {
    ok: true,
    command,
    exitCode: 0,
    stdout,
    stderr: "",
    output: stdout,
    durationMs: 1
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

test("persists completed steps while a command is still running", async () => {
  await withTemporaryConfigAndRoot(async (baseContext) => {
    let markCommandStarted!: () => void;
    let finishCommand!: (result: CommandResult) => void;
    const commandStarted = new Promise<void>((resolve) => {
      markCommandStarted = resolve;
    });
    const commandFinished = new Promise<CommandResult>((resolve) => {
      finishCommand = resolve;
    });
    const context: WorkflowExecutionContext = {
      ...baseContext,
      runShellCommand: async () => {
        markCommandStarted();
        return commandFinished;
      }
    };
    const workflow = await createWorkflow(terminalWorkflowDraft("Progressive persistence", "echo ready"));
    const run = await startWorkflowRun(workflow.id, context);
    assert.ok(run);

    await Promise.race([
      commandStarted,
      delay(5_000).then(() => {
        throw new Error("workflow command did not start");
      })
    ]);
    const inProgress = await readWorkflowRun(run.id);
    assert.equal(inProgress?.status, "running");
    assert.deepEqual(inProgress?.steps.map((step) => step.nodeId), ["trigger", "repositories"]);

    finishCommand(successfulCommandResult("echo ready", "ready\n"));
    const completed = await waitForTerminalRun(run.id);
    assert.equal(completed.status, "success");
    assert.deepEqual(completed.steps.map((step) => step.nodeId), ["trigger", "repositories", "command"]);
    assert.equal(completed.steps.at(-1)?.stdout, "ready");
    assert.deepEqual(completed.summary, {
      selectedProjects: 1,
      succeeded: 3,
      failed: 0,
      skipped: 0,
      commands: 1
    });
  });
});

test("dry runs persist a redacted preview without invoking a command runner", async () => {
  await withTemporaryConfigAndRoot(async (baseContext) => {
    const context: WorkflowExecutionContext = {
      ...baseContext,
      runProjectCommand: async () => {
        throw new Error("dry run unexpectedly invoked the project runner");
      },
      runShellCommand: async () => {
        throw new Error("dry run unexpectedly invoked the shell runner");
      }
    };
    const secretInput = "release candidate; never execute this";
    const workflow = await createWorkflow(inputTerminalWorkflowDraft("Safe preview"));
    const run = await executeDryRun(workflow.id, context, { message: secretInput });

    assert.ok(run);
    assert.equal(run.mode, "dry-run");
    assert.equal(run.status, "success");
    const commandStep = run.steps.find((step) => step.nodeId === "command");
    assert.match(commandStep?.command ?? "", /REPO_CONTROL_INPUT_MESSAGE/);
    assert.equal(commandStep?.command?.includes(secretInput), false);
    const persisted = await readWorkflowRun(run.id);
    assert.equal(persisted?.id, run.id);
    assert.equal(persisted?.status, "success");
    assert.equal(persisted?.steps.length, run.steps.length);
    assert.equal(persisted?.steps.find((step) => step.nodeId === "command")?.command, commandStep?.command);
  });
});

test("cancelling an active run kills the process and marks the run cancelled promptly", async () => {
  await withTemporaryConfigAndRoot(async (context) => {
    const workflow = await createWorkflow(terminalWorkflowDraft("Cancellable", LONG_RUNNING_COMMAND));
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
    const workflow = await createWorkflow(terminalWorkflowDraft("Concurrent", LONG_RUNNING_COMMAND));
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

test("accepts back-to-back runs of the same workflow", async () => {
  await withTemporaryConfigAndRoot(async (context) => {
    const workflow = await createWorkflow(terminalWorkflowDraft("Back to back", "echo hi"));

    // Covers the user-facing shape of the reservation bug: watch a run finish, start the
    // next one straight away. This does NOT deterministically reproduce the original
    // race - that window sits between the terminal status reaching disk and the release
    // continuation running, so whether a reader lands inside it depends on I/O
    // scheduling. It reproduces on CI and not on a local tmpfs. Kept as a guard on the
    // sequence rather than as proof of the fix.
    async function spinUntilTerminal(runId: string): Promise<void> {
      const deadline = Date.now() + 15_000;

      while (Date.now() < deadline) {
        const run = await readWorkflowRun(runId);
        if (run && TERMINAL_RUN_STATUSES.has(run.status)) return;
      }

      throw new Error(`Run ${runId} did not reach a terminal status in time`);
    }

    for (let attempt = 0; attempt < 25; attempt += 1) {
      const run = await startWorkflowRun(workflow.id, context);
      assert.ok(run, `run ${attempt} should start`);
      await spinUntilTerminal(run.id);
    }
  });
});

test("releases the workflow reservation when validation fails before execution", async () => {
  await withTemporaryConfigAndRoot(async (context) => {
    const invalidDraft = terminalWorkflowDraft("Initially invalid", "echo fixed");
    invalidDraft.edges = [];
    const workflow = await createWorkflow(invalidDraft);

    await assert.rejects(() => startWorkflowRun(workflow.id, context), /disconnected/);

    const updated = await updateWorkflow(workflow.id, terminalWorkflowDraft("Now valid", "echo fixed"));
    assert.ok(updated);
    const run = await startWorkflowRun(workflow.id, context);
    assert.ok(run);
    assert.equal((await waitForTerminalRun(run.id)).status, "success");
  });
});

test("reconcileStaleWorkflowRuns marks leftover pending/running records as interrupted", async () => {
  await withTemporaryConfigAndRoot(async (context) => {
    const workflow = await createWorkflow(terminalWorkflowDraft("Interrupted", LONG_RUNNING_COMMAND));
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

// A sweep is only worth running if the repositories that are fine finish. Before this, one
// failure skipped every later node for every repository, including the summary.
test("keeps the healthy repositories going when one of them fails", async () => {
  await withTemporaryConfigAndRoot(async (context) => {
    const workflow = await createWorkflow({
      name: "Per-repository failure",
      description: "",
      nodes: [
        { id: "trigger", type: "trigger.manual", name: "Start", position: { x: 0, y: 0 }, config: {} },
        {
          id: "select",
          type: "repository.select",
          name: "All repositories",
          position: { x: 200, y: 0 },
          config: { mode: "all", projectIds: [] }
        },
        {
          id: "first",
          type: "terminal.command",
          name: "Fails only in breaks",
          position: { x: 400, y: 0 },
          config: {
            command: 'node -e "process.exit(require(\'path\').basename(process.cwd()) === \'breaks\' ? 3 : 0)"'
          }
        },
        {
          id: "second",
          type: "terminal.command",
          name: "Runs everywhere else",
          position: { x: 600, y: 0 },
          config: { command: 'node -e "console.log(\'second step\')"' }
        },
        { id: "summary", type: "output.summary", name: "Summary", position: { x: 800, y: 0 }, config: {} }
      ],
      edges: [
        { id: "e1", source: "trigger", target: "select" },
        { id: "e2", source: "select", target: "first" },
        { id: "e3", source: "first", target: "second" },
        { id: "e4", source: "second", target: "summary" }
      ]
    });

    const started = await startWorkflowRun(workflow.id, context);
    assert.notEqual(started, null);
    const run = await waitForTerminalRun(started?.id ?? "");

    const stepFor = (nodeId: string, projectName: string) =>
      run.steps.find((step) => step.nodeId === nodeId && step.projectName === projectName);

    assert.equal(stepFor("first", "keeps-going")?.status, "success");
    assert.equal(stepFor("first", "breaks")?.status, "failed");

    // The healthy repository carries on; only the failed one drops out of the later step.
    assert.equal(stepFor("second", "keeps-going")?.status, "success");
    assert.equal(stepFor("second", "breaks")?.status, "skipped");
    assert.equal(
      stepFor("second", "breaks")?.message,
      "Skipped because an earlier step failed for this repository"
    );

    // The summary runs even though the run failed, and reports what happened.
    const summaryStep = run.steps.find((step) => step.nodeId === "summary");
    assert.equal(summaryStep?.status, "success");
    assert.match(summaryStep?.message ?? "", /2 repositories selected/);
    assert.match(summaryStep?.message ?? "", /failures in breaks/);
    assert.equal(run.status, "failed");
  }, ["keeps-going", "breaks"]);
});

// The branch is configurable now, and pulling it into a different branch would be a merge.
test("pulls a named branch only where that branch is checked out", async () => {
  await withTemporaryConfigAndRoot(async (context) => {
    const workflow = await createWorkflow({
      name: "Pull branch",
      description: "",
      nodes: [
        { id: "trigger", type: "trigger.manual", name: "Start", position: { x: 0, y: 0 }, config: {} },
        {
          id: "select",
          type: "repository.select",
          name: "All repositories",
          position: { x: 200, y: 0 },
          config: { mode: "all", projectIds: [] }
        },
        {
          id: "pull",
          type: "git.pullBranch",
          name: "Pull release",
          position: { x: 400, y: 0 },
          config: { branch: "release", requireClean: true }
        }
      ],
      edges: [
        { id: "e1", source: "trigger", target: "select" },
        { id: "e2", source: "select", target: "pull" }
      ]
    });

    const dryRun = await executeDryRun(workflow.id, context);
    const pullStep = dryRun?.steps.find((step) => step.nodeId === "pull");

    // The fixture repositories are on main, so the node explains itself instead of merging.
    assert.equal(pullStep?.status, "skipped");
    assert.match(pullStep?.message ?? "", /is on "main", not "release"/);
  });
});

test("refuses a pull node whose branch could be read as a flag", async () => {
  await withTemporaryConfigAndRoot(async (context) => {
    const workflow = await createWorkflow({
      name: "Unsafe branch",
      description: "",
      nodes: [
        { id: "trigger", type: "trigger.manual", name: "Start", position: { x: 0, y: 0 }, config: {} },
        {
          id: "pull",
          type: "git.pullBranch",
          name: "Pull",
          position: { x: 200, y: 0 },
          config: { branch: "--upload-pack=touch /tmp/pwned" }
        }
      ],
      edges: [{ id: "e1", source: "trigger", target: "pull" }]
    });

    await assert.rejects(
      () => executeDryRun(workflow.id, context),
      /invalid branch name/
    );
  });
});
