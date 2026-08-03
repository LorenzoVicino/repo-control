import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  appendBrainTaskDecision,
  appendBrainTaskLog,
  appendBrainTaskRun,
  approveBrainTaskPhase,
  assembleBrainContext,
  BrainValidationError,
  createApprovedBrainTask,
  createBrainTask,
  deleteBrainTask,
  getBrainTaskSpecHash,
  readBrainTask,
  readBrainTasks,
  updateBrainTask
} from "./brainService.js";
import type { BrainTask, BrainTaskRun, CreateApprovedBrainTaskInput } from "./brain/types.js";

const execFileAsync = promisify(execFile);

async function createGitRepository(repositoryPath: string): Promise<void> {
  await fs.mkdir(repositoryPath, { recursive: true });
  await execFileAsync("git", ["init", "-b", "main"], { cwd: repositoryPath });
  await execFileAsync("git", ["config", "user.email", "tests@repo-control.local"], { cwd: repositoryPath });
  await execFileAsync("git", ["config", "user.name", "repo-control tests"], { cwd: repositoryPath });
  await fs.writeFile(path.join(repositoryPath, "README.md"), "initial\n", "utf8");
  await execFileAsync("git", ["add", "README.md"], { cwd: repositoryPath });
  await execFileAsync("git", ["commit", "-m", "initial commit"], { cwd: repositoryPath });
}

function approvedInput(overrides: Partial<CreateApprovedBrainTaskInput> = {}): CreateApprovedBrainTaskInput {
  return {
    title: "Solid release",
    type: "feature",
    contextRepositoryPaths: [],
    definition: { description: "Make risky paths reliable", motivation: "Prevent regressions" },
    requirements: "Every critical flow is covered",
    design: "Exercise persisted state and Git context",
    breakdown: "Implement tests and enforce the gate",
    verificationChecks: ["npm test", " npm test ", "npm run build"],
    planning: {
      profile: "full",
      provider: "codex",
      brief: "Raise coverage",
      generatedAt: "2026-08-03T08:00:00.000Z",
      assumptions: ["Git is available"]
    },
    claudeSessionId: null,
    ...overrides
  };
}

function runFor(task: BrainTask, overrides: Partial<BrainTaskRun> = {}): BrainTaskRun {
  return {
    id: `run-${Date.now()}`,
    status: "succeeded",
    prompt: "Implement the approved plan",
    response: "Done",
    error: null,
    claudeSessionId: "session-1",
    specHash: getBrainTaskSpecHash(task),
    checks: [
      { id: "check-1", command: "npm test", ok: true, exitCode: 0, output: "pass", durationMs: 10 }
    ],
    startedAt: "2026-08-03T09:00:00.000Z",
    completedAt: "2026-08-03T09:01:00.000Z",
    ...overrides
  };
}

test("brain task lifecycle enforces gates, rolls approvals back, persists runs and assembles repository context", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-brain-lifecycle-"));
  const projectPath = path.join(temporaryRoot, "primary-project");
  const contextPath = path.join(temporaryRoot, "context-project");
  const unavailablePath = path.join(temporaryRoot, "plain-folder");
  const previousConfigDirectory = process.env.REPO_CONTROL_CONFIG_DIR;
  process.env.REPO_CONTROL_CONFIG_DIR = path.join(temporaryRoot, "config");

  try {
    await createGitRepository(projectPath);
    await createGitRepository(contextPath);
    await fs.mkdir(unavailablePath);
    await execFileAsync("git", ["remote", "add", "origin", "https://example.test/primary.git"], { cwd: projectPath });

    const empty = await readBrainTasks(projectPath);
    assert.equal(empty.projectName, "primary-project");
    assert.equal(empty.remoteUrl, null);
    assert.deepEqual(empty.tasks, []);

    const task = await createBrainTask(projectPath, {
      title: "  Lifecycle task  ",
      type: "fix",
      contextRepositoryPaths: [projectPath, contextPath, contextPath, "", unavailablePath],
      definition: { description: "Fix the flow", motivation: "Users need it" }
    });
    assert.equal(task.title, "Lifecycle task");
    assert.equal(task.planning.profile, "lean");
    assert.deepEqual(task.contextRepositoryPaths, [path.resolve(contextPath), path.resolve(unavailablePath)]);
    assert.equal((await readBrainTask(projectPath, "missing")), null);
    assert.equal(await updateBrainTask(projectPath, "missing", { title: "nope" }), null);
    assert.equal(await approveBrainTaskPhase(projectPath, "missing", "definition"), null);
    assert.equal(await appendBrainTaskLog(projectPath, "missing", { kind: "note", content: "nope" }), null);
    assert.equal(await appendBrainTaskDecision(projectPath, "missing", { title: "nope", rationale: "nope" }), null);
    assert.equal(await appendBrainTaskRun(projectPath, "missing", runFor(task)), null);

    await assert.rejects(
      approveBrainTaskPhase(projectPath, task.id, "requirements"),
      (error: unknown) => error instanceof BrainValidationError && error.statusCode === 409
    );
    let current = await approveBrainTaskPhase(projectPath, task.id, "definition");
    assert.equal(current?.status, "requirements");
    await assert.rejects(approveBrainTaskPhase(projectPath, task.id, "requirements"), /Requirements content is required/);

    current = await updateBrainTask(projectPath, task.id, {
      phase: "requirements",
      content: "Requirements",
      verificationChecks: ["npm test", "npm test", " ", "npm run build"],
      git: { branch: " feature/solid ", prUrl: " https://example.test/pr/1 " },
      claudeSessionId: " session-original "
    });
    assert.deepEqual(current?.verificationChecks, ["npm test", "npm run build"]);
    assert.deepEqual(current?.git, { branch: "feature/solid", prUrl: "https://example.test/pr/1" });
    current = await approveBrainTaskPhase(projectPath, task.id, "requirements");
    assert.equal(current?.status, "design");
    await assert.rejects(approveBrainTaskPhase(projectPath, task.id, "design"), /Design content is required/);

    current = await updateBrainTask(projectPath, task.id, { phase: "design", content: "Design" });
    current = await approveBrainTaskPhase(projectPath, task.id, "design");
    assert.equal(current?.status, "breakdown");
    await assert.rejects(approveBrainTaskPhase(projectPath, task.id, "breakdown"), /Task breakdown content is required/);
    current = await updateBrainTask(projectPath, task.id, { phase: "breakdown", content: "Steps" });
    current = await approveBrainTaskPhase(projectPath, task.id, "breakdown");
    assert.equal(current?.status, "implementation");

    await assert.rejects(approveBrainTaskPhase(projectPath, task.id, "implementation"), /successful run/);
    assert.ok(current);
    const failedRun = runFor(current, {
      id: "run-failed",
      status: "failed",
      error: "tests failed",
      claudeSessionId: null,
      checks: []
    });
    current = await appendBrainTaskRun(projectPath, task.id, failedRun);
    assert.equal(current?.implementation.log[0]?.kind, "fix");
    assert.equal(current?.implementation.log[0]?.content, "tests failed");
    await assert.rejects(approveBrainTaskPhase(projectPath, task.id, "implementation"), /successful run/);

    assert.ok(current);
    current = await appendBrainTaskRun(projectPath, task.id, runFor(current, { id: "run-success" }));
    assert.equal(current?.implementation.log[0]?.kind, "result");
    assert.equal(current?.claudeSessionId, "session-1");
    current = await approveBrainTaskPhase(projectPath, task.id, "implementation");
    assert.equal(current?.status, "done");

    current = await appendBrainTaskLog(projectPath, task.id, { kind: "note", content: "Documented behavior" });
    current = await appendBrainTaskDecision(projectPath, task.id, { title: "Keep local storage", rationale: "Offline first" });
    assert.equal(current?.implementation.log[0]?.content, "Documented behavior");
    assert.equal(current?.decisions[0]?.title, "Keep local storage");

    current = await updateBrainTask(projectPath, task.id, { contextRepositoryPaths: [contextPath] });
    assert.equal(current?.status, "implementation");
    current = await updateBrainTask(projectPath, task.id, {
      title: "Changed definition",
      type: "refactor",
      definition: { description: "Changed", motivation: "Still needed" }
    });
    assert.equal(current?.status, "definition");
    assert.equal(current?.requirements.approvedAt, null);

    const approved = await createApprovedBrainTask(projectPath, approvedInput({
      title: "Rollback task",
      contextRepositoryPaths: [contextPath, unavailablePath]
    }));
    let rolledBack = await updateBrainTask(projectPath, approved.id, { phase: "requirements", content: "Changed requirements" });
    assert.equal(rolledBack?.status, "requirements");
    assert.equal(rolledBack?.design.approvedAt, null);

    const designRollback = await createApprovedBrainTask(projectPath, approvedInput({ title: "Design rollback" }));
    rolledBack = await updateBrainTask(projectPath, designRollback.id, { phase: "design", content: "Changed design" });
    assert.equal(rolledBack?.status, "design");
    assert.equal(rolledBack?.breakdown.approvedAt, null);

    const breakdownRollback = await createApprovedBrainTask(projectPath, approvedInput({ title: "Breakdown rollback" }));
    rolledBack = await updateBrainTask(projectPath, breakdownRollback.id, { phase: "breakdown", content: "Changed breakdown" });
    assert.equal(rolledBack?.status, "breakdown");

    await fs.appendFile(path.join(projectPath, "README.md"), "modified\n", "utf8");
    await fs.writeFile(path.join(projectPath, "new.txt"), "new\n", "utf8");
    await execFileAsync("git", ["add", "new.txt"], { cwd: projectPath });
    const context = await assembleBrainContext(projectPath, approved);
    assert.match(context, /# repo-control brain context/);
    assert.match(context, /primary-project \(primary\)/);
    assert.match(context, /context-project \(context\)/);
    assert.match(context, /plain-folder \(context\)/);
    assert.match(context, /Git status: unavailable/);
    assert.match(context, /Working tree: dirty/);
    assert.match(context, /Recent decisions/);
    assert.match(context, /Related tasks/);

    assert.equal(await deleteBrainTask(projectPath, breakdownRollback.id), true);
    assert.equal(await deleteBrainTask(projectPath, "missing"), false);
  } finally {
    if (previousConfigDirectory === undefined) delete process.env.REPO_CONTROL_CONFIG_DIR;
    else process.env.REPO_CONTROL_CONFIG_DIR = previousConfigDirectory;
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("brain storage rejects incomplete approved tasks and normalizes corrupt or legacy payloads", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-brain-normalize-"));
  const projectPath = path.join(temporaryRoot, "legacy-project");
  const configPath = path.join(temporaryRoot, "config");
  const previousConfigDirectory = process.env.REPO_CONTROL_CONFIG_DIR;
  process.env.REPO_CONTROL_CONFIG_DIR = configPath;
  await fs.mkdir(projectPath, { recursive: true });

  try {
    const requiredCases: Array<[Partial<CreateApprovedBrainTaskInput>, RegExp]> = [
      [{ title: " " }, /title/i],
      [{ definition: { description: " ", motivation: "" } }, /description/i],
      [{ requirements: " " }, /requirements/i],
      [{ design: " " }, /design/i],
      [{ breakdown: " " }, /breakdown/i],
      [{ verificationChecks: [" "] }, /verification/i]
    ];
    for (const [override, message] of requiredCases) {
      await assert.rejects(createApprovedBrainTask(projectPath, approvedInput(override)), message);
    }

    const fileKey = path.resolve(projectPath).replace(/\\/g, "/").replace(/[/:\\]/g, "-");
    const brainPath = path.join(configPath, "brain", `${fileKey}.json`);
    await fs.mkdir(path.dirname(brainPath), { recursive: true });
    await fs.writeFile(brainPath, "{ invalid json", "utf8");
    assert.deepEqual((await readBrainTasks(projectPath)).tasks, []);

    const longText = "x".repeat(2500);
    await fs.writeFile(brainPath, JSON.stringify({
      projectName: " ",
      remoteUrl: 42,
      tasks: [
        null,
        {
          id: "legacy",
          title: " ",
          type: "bug",
          status: "unknown",
          contextRepositoryPaths: [projectPath, " ", 7, ...Array.from({ length: 15 }, (_, i) => path.join(temporaryRoot, `repo-${i}`))],
          definition: { description: longText, motivation: 8 },
          requirements: { content: 3, approvedAt: "bad-date" },
          design: null,
          breakdown: { content: "steps", approvedAt: "2026-08-03T00:00:00.000Z" },
          verificationChecks: [" test ", "test", 4],
          planning: { profile: "invalid", provider: "other", brief: "", generatedAt: "bad", assumptions: ["a", 2] },
          implementation: {
            log: [null, { id: "", kind: "invalid", content: "entry", createdAt: "bad" }, { content: "" }],
            runs: [
              null,
              { id: "", status: "succeeded" },
              {
                id: "legacy-run",
                status: "other",
                prompt: 3,
                response: "response",
                error: 5,
                claudeSessionId: " ",
                specHash: "hash",
                checks: [null, { id: "", command: " ", ok: true }, { command: " check ", ok: false, exitCode: "1", output: 2, durationMs: -4 }],
                startedAt: "bad",
                completedAt: 4
              }
            ]
          },
          decisions: [null, { title: "", rationale: "none" }, { id: "", title: "Decision", rationale: "Because", createdAt: "bad" }],
          git: { branch: " ", prUrl: 7 },
          claudeSessionId: 9,
          createdAt: "bad",
          updatedAt: null
        }
      ]
    }), "utf8");

    const normalized = await readBrainTasks(projectPath);
    assert.equal(normalized.tasks.length, 2);
    const legacy = normalized.tasks.find((task) => task.id === "legacy")!;
    assert.equal(legacy.title, "Untitled task");
    assert.equal(legacy.type, "fix");
    assert.equal(legacy.status, "definition");
    assert.equal(legacy.contextRepositoryPaths.length, 12);
    assert.equal(legacy.planning.profile, "lean");
    assert.equal(legacy.planning.provider, "manual");
    assert.equal(legacy.implementation.log[0]?.kind, "note");
    assert.equal(legacy.implementation.runs[0]?.status, "failed");
    assert.equal(legacy.implementation.runs[0]?.checks[0]?.exitCode, null);
    assert.equal(legacy.implementation.runs[0]?.checks[0]?.durationMs, 0);
    assert.equal(legacy.decisions.length, 1);
    assert.equal(legacy.git.branch, null);

    const context = await assembleBrainContext(projectPath, legacy);
    assert.match(context, /Description: x+/);
    assert.match(context, /\.\.\./);

    await fs.writeFile(brainPath, JSON.stringify([]), "utf8");
    assert.deepEqual((await readBrainTasks(projectPath)).tasks, []);
  } finally {
    if (previousConfigDirectory === undefined) delete process.env.REPO_CONTROL_CONFIG_DIR;
    else process.env.REPO_CONTROL_CONFIG_DIR = previousConfigDirectory;
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});
