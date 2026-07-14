import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { simpleGit } from "simple-git";
import { getConfigDirectory } from "../preferences.js";
import type {
  AppendBrainDecisionInput,
  AppendBrainLogInput,
  BrainContentPhase,
  BrainDecision,
  BrainFile,
  BrainGatePhase,
  BrainLogEntry,
  BrainPhaseState,
  BrainRunCheck,
  BrainTask,
  BrainTaskRun,
  BrainTasksResponse,
  BrainTaskStatus,
  BrainTaskType,
  CreateBrainTaskInput,
  RepositoryContext,
  UpdateBrainTaskInput
} from "./brain/types.js";

export class BrainValidationError extends Error {
  statusCode = 409;
}

const MAX_RELATED_TASKS = 5;
const MAX_CONTEXT_SECTION_LENGTH = 2400;
const MAX_CONTEXT_REPOSITORIES = 12;
const TASK_TYPES: BrainTaskType[] = ["feature", "fix", "refactor", "chore", "spike"];
const TASK_STATUSES: BrainTaskStatus[] = [
  "definition",
  "requirements",
  "design",
  "breakdown",
  "implementation",
  "done"
];
const LOG_KINDS: BrainLogEntry["kind"][] = ["note", "fix", "result"];

export async function readBrainTasks(projectPath: string): Promise<BrainTasksResponse> {
  const brainFile = await readBrainFile(projectPath);

  return {
    projectPath: brainFile.projectPath,
    projectName: brainFile.projectName,
    remoteUrl: brainFile.remoteUrl,
    tasks: brainFile.tasks
  };
}

export async function readBrainTask(projectPath: string, taskId: string): Promise<BrainTask | null> {
  const brainFile = await readBrainFile(projectPath);

  return brainFile.tasks.find((task) => task.id === taskId) ?? null;
}

export async function createBrainTask(projectPath: string, input: CreateBrainTaskInput): Promise<BrainTask> {
  const brainFile = await readBrainFile(projectPath);
  const now = new Date().toISOString();
  const task = normalizeBrainTask({
    id: randomUUID(),
    title: input.title,
    type: input.type,
    status: "definition",
    contextRepositoryPaths: input.contextRepositoryPaths,
    definition: input.definition,
    requirements: createEmptyPhase(),
    design: createEmptyPhase(),
    breakdown: createEmptyPhase(),
    implementation: { log: [], runs: [] },
    decisions: [],
    git: { branch: null, prUrl: null },
    claudeSessionId: null,
    createdAt: now,
    updatedAt: now
  }, projectPath);

  brainFile.tasks = [task, ...brainFile.tasks];
  await writeBrainFile(projectPath, brainFile);
  return task;
}

export async function updateBrainTask(
  projectPath: string,
  taskId: string,
  input: UpdateBrainTaskInput
): Promise<BrainTask | null> {
  const brainFile = await readBrainFile(projectPath);
  const task = brainFile.tasks.find((currentTask) => currentTask.id === taskId);

  if (!task) {
    return null;
  }

  const now = new Date().toISOString();
  let nextTask: BrainTask = {
    ...task,
    contextRepositoryPaths: [...task.contextRepositoryPaths],
    definition: { ...task.definition },
    requirements: { ...task.requirements },
    design: { ...task.design },
    breakdown: { ...task.breakdown },
    implementation: { log: [...task.implementation.log], runs: [...task.implementation.runs] },
    decisions: [...task.decisions],
    git: { ...task.git },
    updatedAt: now
  };
  const originalDefinition = JSON.stringify({
    title: nextTask.title,
    type: nextTask.type,
    definition: nextTask.definition
  });

  if (input.title !== undefined) {
    nextTask.title = normalizeText(input.title, nextTask.title).slice(0, 160);
  }

  if (input.type !== undefined) {
    nextTask.type = input.type;
  }

  if (input.contextRepositoryPaths !== undefined) {
    const nextContextRepositoryPaths = normalizeContextRepositoryPaths(input.contextRepositoryPaths, projectPath);
    const contextChanged = JSON.stringify(nextTask.contextRepositoryPaths) !== JSON.stringify(nextContextRepositoryPaths);
    nextTask.contextRepositoryPaths = nextContextRepositoryPaths;

    if (contextChanged && nextTask.status === "done") {
      nextTask.status = "implementation";
    }
  }

  if (input.definition) {
    nextTask.definition = {
      description:
        input.definition.description === undefined
          ? nextTask.definition.description
          : input.definition.description.slice(0, 20_000),
      motivation:
        input.definition.motivation === undefined
          ? nextTask.definition.motivation
          : input.definition.motivation.slice(0, 20_000)
    };
  }

  const nextDefinition = JSON.stringify({
    title: nextTask.title,
    type: nextTask.type,
    definition: nextTask.definition
  });

  if (originalDefinition !== nextDefinition && nextTask.status !== "definition") {
    nextTask = rollbackApprovalsFromDefinition(nextTask);
  }

  if (input.phase && input.content !== undefined) {
    const previousContent = nextTask[input.phase].content;
    nextTask[input.phase] = {
      ...nextTask[input.phase],
      content: input.content.slice(0, 120_000)
    };

    if (previousContent !== nextTask[input.phase].content && nextTask[input.phase].approvedAt) {
      nextTask = rollbackApprovalsFromPhase(nextTask, input.phase);
    }
  }

  if (input.git) {
    nextTask.git = {
      branch: input.git.branch === undefined ? nextTask.git.branch : normalizeNullableText(input.git.branch, 255),
      prUrl: input.git.prUrl === undefined ? nextTask.git.prUrl : normalizeNullableText(input.git.prUrl, 2000)
    };
  }

  if (input.claudeSessionId !== undefined) {
    nextTask.claudeSessionId = normalizeNullableText(input.claudeSessionId, 160);
  }

  nextTask = normalizeBrainTask(nextTask, projectPath);
  brainFile.tasks = sortTasks(brainFile.tasks.map((currentTask) => (currentTask.id === taskId ? nextTask : currentTask)));
  await writeBrainFile(projectPath, brainFile);
  return nextTask;
}

export async function approveBrainTaskPhase(
  projectPath: string,
  taskId: string,
  phase: BrainGatePhase
): Promise<BrainTask | null> {
  const brainFile = await readBrainFile(projectPath);
  const task = brainFile.tasks.find((currentTask) => currentTask.id === taskId);

  if (!task) {
    return null;
  }

  const now = new Date().toISOString();
  const nextTask: BrainTask = normalizeBrainTask({
    ...task,
    definition: { ...task.definition },
    requirements: { ...task.requirements },
    design: { ...task.design },
    breakdown: { ...task.breakdown },
    implementation: { log: [...task.implementation.log], runs: [...task.implementation.runs] },
    decisions: [...task.decisions],
    git: { ...task.git },
    updatedAt: now
  });

  if (phase === "definition") {
    assertHasText(nextTask.title, "Task title is required.");
    assertHasText(nextTask.definition.description, "Task description is required before requirements.");
    nextTask.status = nextTask.status === "definition" ? "requirements" : nextTask.status;
  } else if (phase === "requirements") {
    assertStatusAtLeast(nextTask, "requirements", "Approve the definition before requirements.");
    assertHasText(nextTask.requirements.content, "Requirements content is required.");
    nextTask.requirements.approvedAt = nextTask.requirements.approvedAt ?? now;
    nextTask.status = nextTask.status === "requirements" ? "design" : nextTask.status;
  } else if (phase === "design") {
    assertApproved(nextTask.requirements.approvedAt, "Approve requirements before design.");
    assertStatusAtLeast(nextTask, "design", "Move to design before approving it.");
    assertHasText(nextTask.design.content, "Design content is required.");
    nextTask.design.approvedAt = nextTask.design.approvedAt ?? now;
    nextTask.status = nextTask.status === "design" ? "breakdown" : nextTask.status;
  } else if (phase === "breakdown") {
    assertApproved(nextTask.design.approvedAt, "Approve design before task breakdown.");
    assertStatusAtLeast(nextTask, "breakdown", "Move to breakdown before approving it.");
    assertHasText(nextTask.breakdown.content, "Task breakdown content is required.");
    nextTask.breakdown.approvedAt = nextTask.breakdown.approvedAt ?? now;
    nextTask.status = nextTask.status === "breakdown" ? "implementation" : nextTask.status;
  } else {
    assertApproved(nextTask.breakdown.approvedAt, "Approve task breakdown before implementation.");
    assertStatusAtLeast(nextTask, "implementation", "Move to implementation before closing the task.");
    const latestSuccessfulRun = nextTask.implementation.runs.find((run) => run.status === "succeeded");

    if (!latestSuccessfulRun || latestSuccessfulRun.specHash !== getBrainTaskSpecHash(nextTask)) {
      throw new BrainValidationError("A successful run for the current approved spec is required before closing the task.");
    }
    nextTask.status = "done";
  }

  brainFile.tasks = sortTasks(brainFile.tasks.map((currentTask) => (currentTask.id === taskId ? nextTask : currentTask)));
  await writeBrainFile(projectPath, brainFile);
  return nextTask;
}

export async function appendBrainTaskLog(
  projectPath: string,
  taskId: string,
  input: AppendBrainLogInput
): Promise<BrainTask | null> {
  const brainFile = await readBrainFile(projectPath);
  const task = brainFile.tasks.find((currentTask) => currentTask.id === taskId);

  if (!task) {
    return null;
  }

  const now = new Date().toISOString();
  const nextTask = normalizeBrainTask({
    ...task,
    implementation: {
      log: [
        {
          id: randomUUID(),
          kind: input.kind,
          content: input.content,
          createdAt: now
        },
        ...task.implementation.log
      ],
      runs: [...task.implementation.runs]
    },
    updatedAt: now
  });

  brainFile.tasks = sortTasks(brainFile.tasks.map((currentTask) => (currentTask.id === taskId ? nextTask : currentTask)));
  await writeBrainFile(projectPath, brainFile);
  return nextTask;
}

export async function appendBrainTaskRun(
  projectPath: string,
  taskId: string,
  run: BrainTaskRun
): Promise<BrainTask | null> {
  const brainFile = await readBrainFile(projectPath);
  const task = brainFile.tasks.find((currentTask) => currentTask.id === taskId);

  if (!task) {
    return null;
  }

  const nextTask = normalizeBrainTask({
    ...task,
    implementation: {
      log: [
        {
          id: randomUUID(),
          kind: run.status === "succeeded" ? "result" : "fix",
          content: run.status === "succeeded" ? "Engineering run completed successfully." : run.error ?? "Engineering run failed.",
          createdAt: run.completedAt
        },
        ...task.implementation.log
      ],
      runs: [run, ...task.implementation.runs]
    },
    claudeSessionId: run.claudeSessionId ?? task.claudeSessionId,
    updatedAt: run.completedAt
  });

  brainFile.tasks = sortTasks(brainFile.tasks.map((currentTask) => (currentTask.id === taskId ? nextTask : currentTask)));
  await writeBrainFile(projectPath, brainFile);
  return nextTask;
}

export function getBrainTaskSpecHash(task: BrainTask): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        title: task.title,
        type: task.type,
        contextRepositoryPaths: [...task.contextRepositoryPaths].sort(),
        definition: task.definition,
        requirements: task.requirements.content,
        design: task.design.content,
        breakdown: task.breakdown.content
      })
    )
    .digest("hex");
}

export async function appendBrainTaskDecision(
  projectPath: string,
  taskId: string,
  input: AppendBrainDecisionInput
): Promise<BrainTask | null> {
  const brainFile = await readBrainFile(projectPath);
  const task = brainFile.tasks.find((currentTask) => currentTask.id === taskId);

  if (!task) {
    return null;
  }

  const now = new Date().toISOString();
  const nextTask = normalizeBrainTask({
    ...task,
    decisions: [
      {
        id: randomUUID(),
        title: input.title,
        rationale: input.rationale,
        createdAt: now
      },
      ...task.decisions
    ],
    updatedAt: now
  });

  brainFile.tasks = sortTasks(brainFile.tasks.map((currentTask) => (currentTask.id === taskId ? nextTask : currentTask)));
  await writeBrainFile(projectPath, brainFile);
  return nextTask;
}

export async function deleteBrainTask(projectPath: string, taskId: string): Promise<boolean> {
  const brainFile = await readBrainFile(projectPath);
  const nextTasks = brainFile.tasks.filter((task) => task.id !== taskId);

  if (nextTasks.length === brainFile.tasks.length) {
    return false;
  }

  await writeBrainFile(projectPath, {
    ...brainFile,
    tasks: nextTasks
  });
  return true;
}

export async function assembleBrainContext(projectPath: string, task: BrainTask): Promise<string> {
  const brainFile = await readBrainFile(projectPath);
  const repositoryPaths = [projectPath, ...task.contextRepositoryPaths].filter(
    (repositoryPath, index, paths) => paths.indexOf(repositoryPath) === index
  );
  const repositories = await Promise.all(
    repositoryPaths.map((repositoryPath, index) =>
      readRepositoryContext(repositoryPath, index === 0 ? "primary" : "context")
    )
  );
  const relatedTasks = brainFile.tasks
    .filter((currentTask) => currentTask.id !== task.id)
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, MAX_RELATED_TASKS);
  const decisions = brainFile.tasks
    .flatMap((currentTask) =>
      currentTask.decisions.map((decision) => ({
        ...decision,
        taskTitle: currentTask.title
      }))
    )
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 8);

  return [
    "# repo-control brain context",
    `Project: ${brainFile.projectName}`,
    "The engineering run operates in the primary repository. Context repositories are read-only references for dependency analysis.",
    ["## Repository scope", ...repositories.map(formatRepositoryContext)].join("\n\n"),
    "## Current task",
    formatTaskForContext(task),
    relatedTasks.length > 0
      ? ["## Related tasks", ...relatedTasks.map((relatedTask) => formatRelatedTaskForContext(relatedTask))].join("\n\n")
      : null,
    decisions.length > 0
      ? [
          "## Recent decisions",
          ...decisions.map((decision) =>
            [
              `- ${decision.title} (${decision.taskTitle}, ${decision.createdAt})`,
              `  Rationale: ${truncateContext(decision.rationale)}`
            ].join("\n")
          )
        ].join("\n")
      : null
  ]
    .filter((section): section is string => Boolean(section))
    .join("\n\n");
}

async function readBrainFile(projectPath: string): Promise<BrainFile> {
  const brainPath = getBrainPath(projectPath);
  const content = await fs.readFile(brainPath, "utf8").catch(() => null);

  if (!content) {
    return createEmptyBrainFile(projectPath);
  }

  try {
    return normalizeBrainFile(JSON.parse(content), projectPath);
  } catch {
    return createEmptyBrainFile(projectPath);
  }
}

async function writeBrainFile(projectPath: string, brainFile: BrainFile): Promise<void> {
  const brainPath = getBrainPath(projectPath);
  const metadata = await readProjectMetadata(projectPath);
  const normalizedFile = normalizeBrainFile(
    {
      ...brainFile,
      projectName: metadata.projectName,
      remoteUrl: metadata.remoteUrl
    },
    projectPath
  );

  await fs.mkdir(path.dirname(brainPath), { recursive: true });
  await fs.writeFile(`${brainPath}.tmp`, `${JSON.stringify(normalizedFile, null, 2)}\n`, "utf8");
  await fs.rename(`${brainPath}.tmp`, brainPath);
}

function normalizeBrainFile(value: unknown, projectPath: string): BrainFile {
  const raw = isRecord(value) ? value : {};
  const projectName = normalizeText(raw.projectName, path.basename(projectPath));
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks.map((task) => normalizeBrainTask(task, projectPath)).filter((task): task is BrainTask => Boolean(task.id))
    : [];

  return {
    version: 1,
    projectPath,
    projectName,
    remoteUrl: normalizeNullableText(raw.remoteUrl, 2000),
    tasks: sortTasks(tasks)
  };
}

function normalizeBrainTask(value: unknown, projectPath?: string): BrainTask {
  const raw = isRecord(value) ? value : {};
  const now = new Date().toISOString();
  const rawDefinition = isRecord(raw.definition) ? raw.definition : {};
  const rawImplementation = isRecord(raw.implementation) ? raw.implementation : {};
  const rawGit = isRecord(raw.git) ? raw.git : {};

  return {
    id: normalizeText(raw.id, randomUUID()).slice(0, 160),
    title: normalizeText(raw.title, "Untitled task").slice(0, 160),
    type: normalizeTaskType(raw.type),
    status: normalizeTaskStatus(raw.status),
    contextRepositoryPaths: normalizeContextRepositoryPaths(raw.contextRepositoryPaths, projectPath),
    definition: {
      description: getString(rawDefinition.description).slice(0, 20_000),
      motivation: getString(rawDefinition.motivation).slice(0, 20_000)
    },
    requirements: normalizePhase(raw.requirements),
    design: normalizePhase(raw.design),
    breakdown: normalizePhase(raw.breakdown),
    implementation: {
      log: Array.isArray(rawImplementation.log)
        ? rawImplementation.log
            .map(normalizeLogEntry)
            .filter((entry): entry is BrainLogEntry => entry !== null)
            .slice(0, 200)
        : [],
      runs: Array.isArray(rawImplementation.runs)
        ? rawImplementation.runs
            .map(normalizeTaskRun)
            .filter((run): run is BrainTaskRun => run !== null)
            .slice(0, 25)
        : []
    },
    decisions: Array.isArray(raw.decisions)
      ? raw.decisions
          .map(normalizeDecision)
          .filter((decision): decision is BrainDecision => decision !== null)
          .slice(0, 200)
      : [],
    git: {
      branch: normalizeNullableText(rawGit.branch, 255),
      prUrl: normalizeNullableText(rawGit.prUrl, 2000)
    },
    claudeSessionId: normalizeNullableText(raw.claudeSessionId, 160),
    createdAt: normalizeIsoString(raw.createdAt, now),
    updatedAt: normalizeIsoString(raw.updatedAt, now)
  };
}

function normalizePhase(value: unknown): BrainPhaseState {
  const raw = isRecord(value) ? value : {};

  return {
    content: getString(raw.content).slice(0, 120_000),
    approvedAt: normalizeNullableIsoString(raw.approvedAt)
  };
}

function normalizeLogEntry(value: unknown): BrainLogEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const content = getString(value.content).slice(0, 20_000);

  if (!content) {
    return null;
  }

  return {
    id: normalizeText(value.id, randomUUID()).slice(0, 160),
    kind: LOG_KINDS.includes(value.kind as BrainLogEntry["kind"]) ? (value.kind as BrainLogEntry["kind"]) : "note",
    content,
    createdAt: normalizeIsoString(value.createdAt, new Date().toISOString())
  };
}

function normalizeDecision(value: unknown): BrainDecision | null {
  if (!isRecord(value)) {
    return null;
  }

  const title = normalizeText(value.title, "").slice(0, 160);
  const rationale = getString(value.rationale).slice(0, 20_000);

  if (!title || !rationale) {
    return null;
  }

  return {
    id: normalizeText(value.id, randomUUID()).slice(0, 160),
    title,
    rationale,
    createdAt: normalizeIsoString(value.createdAt, new Date().toISOString())
  };
}

function normalizeTaskRun(value: unknown): BrainTaskRun | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = normalizeText(value.id, "").slice(0, 160);
  const startedAt = normalizeIsoString(value.startedAt, new Date().toISOString());

  if (!id) {
    return null;
  }

  return {
    id,
    status: value.status === "succeeded" ? "succeeded" : "failed",
    prompt: getString(value.prompt).slice(0, 20_000),
    response: getString(value.response).slice(0, 30_000),
    error: normalizeNullableText(value.error, 4000),
    claudeSessionId: normalizeNullableText(value.claudeSessionId, 160),
    specHash: getString(value.specHash).slice(0, 64),
    checks: Array.isArray(value.checks)
      ? value.checks.map(normalizeRunCheck).filter((check): check is BrainRunCheck => check !== null).slice(0, 12)
      : [],
    startedAt,
    completedAt: normalizeIsoString(value.completedAt, startedAt)
  };
}

function normalizeRunCheck(value: unknown): BrainRunCheck | null {
  if (!isRecord(value)) {
    return null;
  }

  const command = getString(value.command).trim().slice(0, 1000);

  if (!command) {
    return null;
  }

  return {
    id: normalizeText(value.id, randomUUID()).slice(0, 160),
    command,
    ok: value.ok === true,
    exitCode: typeof value.exitCode === "number" ? value.exitCode : null,
    output: getString(value.output).slice(0, 30_000),
    durationMs: typeof value.durationMs === "number" ? Math.max(0, value.durationMs) : 0
  };
}

function rollbackApprovalsFromPhase(task: BrainTask, phase: BrainContentPhase): BrainTask {
  const nextTask: BrainTask = {
    ...task,
    requirements: { ...task.requirements },
    design: { ...task.design },
    breakdown: { ...task.breakdown }
  };

  if (phase === "requirements") {
    nextTask.requirements.approvedAt = null;
    nextTask.design.approvedAt = null;
    nextTask.breakdown.approvedAt = null;
    nextTask.status = "requirements";
  } else if (phase === "design") {
    nextTask.design.approvedAt = null;
    nextTask.breakdown.approvedAt = null;
    nextTask.status = "design";
  } else {
    nextTask.breakdown.approvedAt = null;
    nextTask.status = "breakdown";
  }

  return nextTask;
}

function rollbackApprovalsFromDefinition(task: BrainTask): BrainTask {
  return {
    ...task,
    status: "definition",
    requirements: { ...task.requirements, approvedAt: null },
    design: { ...task.design, approvedAt: null },
    breakdown: { ...task.breakdown, approvedAt: null }
  };
}

function assertApproved(value: string | null, message: string): void {
  if (!value) {
    throw new BrainValidationError(message);
  }
}

function assertHasText(value: string, message: string): void {
  if (!value.trim()) {
    throw new BrainValidationError(message);
  }
}

function assertStatusAtLeast(task: BrainTask, status: BrainTaskStatus, message: string): void {
  if (TASK_STATUSES.indexOf(task.status) < TASK_STATUSES.indexOf(status)) {
    throw new BrainValidationError(message);
  }
}

function createEmptyBrainFile(projectPath: string): BrainFile {
  return {
    version: 1,
    projectPath,
    projectName: path.basename(projectPath),
    remoteUrl: null,
    tasks: []
  };
}

function createEmptyPhase(): BrainPhaseState {
  return {
    content: "",
    approvedAt: null
  };
}

function getBrainPath(projectPath: string): string {
  return path.join(getConfigDirectory(), "brain", `${getBrainFileKey(projectPath)}.json`);
}

function getBrainFileKey(projectPath: string): string {
  return path.resolve(projectPath).replace(/\\/g, "/").replace(/[/:\\]/g, "-");
}

async function readProjectMetadata(projectPath: string): Promise<{ projectName: string; remoteUrl: string | null }> {
  const remoteUrl = await simpleGit(projectPath)
    .raw(["config", "--get", "remote.origin.url"])
    .then((output) => output.trim() || null)
    .catch(() => null);

  return {
    projectName: path.basename(projectPath),
    remoteUrl
  };
}

async function readRepositoryContext(
  projectPath: string,
  role: RepositoryContext["role"]
): Promise<RepositoryContext> {
  const resolvedProjectPath = path.resolve(projectPath);
  const gitDirectoryExists = await fs
    .access(path.join(resolvedProjectPath, ".git"))
    .then(() => true)
    .catch(() => false);

  if (!gitDirectoryExists) {
    return {
      role,
      name: path.basename(resolvedProjectPath),
      projectPath: resolvedProjectPath,
      available: false,
      remoteUrl: null,
      branch: null,
      upstream: null,
      isClean: null,
      staged: 0,
      modified: 0,
      untracked: 0,
      conflicted: 0,
      ahead: 0,
      behind: 0,
      recentCommits: []
    };
  }

  const git = simpleGit(resolvedProjectPath);
  const [status, remoteUrl, logOutput] = await Promise.all([
    git.status().catch(() => null),
    git
      .raw(["config", "--get", "remote.origin.url"])
      .then((output) => output.trim() || null)
      .catch(() => null),
    git.raw(["log", "--max-count=3", "--pretty=format:%h%x09%s"]).catch(() => "")
  ]);

  return {
    role,
    name: path.basename(resolvedProjectPath),
    projectPath: resolvedProjectPath,
    available: status !== null,
    remoteUrl,
    branch: status?.current || (status?.detached ? "(detached)" : null),
    upstream: status?.tracking || null,
    isClean: status?.isClean() ?? null,
    staged: status?.staged.length ?? 0,
    modified: (status?.modified.length ?? 0) + (status?.deleted.length ?? 0) + (status?.renamed.length ?? 0),
    untracked: status?.not_added.length ?? 0,
    conflicted: status?.conflicted.length ?? 0,
    ahead: status?.ahead ?? 0,
    behind: status?.behind ?? 0,
    recentCommits: logOutput
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
  };
}

function sortTasks(tasks: BrainTask[]): BrainTask[] {
  return [...tasks].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function normalizeTaskType(value: unknown): BrainTaskType {
  if (value === "bug") {
    return "fix";
  }

  return TASK_TYPES.includes(value as BrainTaskType) ? (value as BrainTaskType) : "feature";
}

function normalizeTaskStatus(value: unknown): BrainTaskStatus {
  return TASK_STATUSES.includes(value as BrainTaskStatus) ? (value as BrainTaskStatus) : "definition";
}

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function normalizeContextRepositoryPaths(value: unknown, primaryProjectPath?: string): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const primaryPath = primaryProjectPath ? path.resolve(primaryProjectPath) : null;
  const repositoryPaths = value
    .filter(
      (repositoryPath): repositoryPath is string =>
        typeof repositoryPath === "string" && Boolean(repositoryPath.trim())
    )
    .map((repositoryPath) => path.resolve(repositoryPath.trim()))
    .filter((repositoryPath) => repositoryPath !== primaryPath);

  return [...new Set(repositoryPaths)].slice(0, MAX_CONTEXT_REPOSITORIES);
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeNullableText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue ? normalizedValue.slice(0, maxLength) : null;
}

function normalizeIsoString(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  return Number.isNaN(Date.parse(value)) ? fallback : value;
}

function normalizeNullableIsoString(value: unknown): string | null {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    return null;
  }

  return value;
}

function formatTaskForContext(task: BrainTask): string {
  return [
    `Title: ${task.title}`,
    `Type: ${task.type}`,
    `Status: ${task.status}`,
    `Description: ${truncateContext(task.definition.description)}`,
    task.definition.motivation ? `Motivation: ${truncateContext(task.definition.motivation)}` : null,
    task.requirements.content ? `Requirements:\n${truncateContext(task.requirements.content)}` : null,
    task.design.content ? `Design:\n${truncateContext(task.design.content)}` : null,
    task.breakdown.content ? `Tasks:\n${truncateContext(task.breakdown.content)}` : null
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");
}

function formatRepositoryContext(repository: RepositoryContext): string {
  if (!repository.available) {
    return [
      `### ${repository.name} (${repository.role})`,
      `Path: ${repository.projectPath}`,
      "Git status: unavailable"
    ].join("\n");
  }

  const workingTree = repository.isClean
    ? "clean"
    : `dirty (staged: ${repository.staged}, modified: ${repository.modified}, untracked: ${repository.untracked}, conflicted: ${repository.conflicted})`;

  return [
    `### ${repository.name} (${repository.role})`,
    `Path: ${repository.projectPath}`,
    repository.remoteUrl ? `Remote: ${repository.remoteUrl}` : null,
    `Branch: ${repository.branch ?? "(unknown)"}`,
    repository.upstream ? `Upstream: ${repository.upstream}` : null,
    `Working tree: ${workingTree}`,
    `Sync: ahead ${repository.ahead}, behind ${repository.behind}`,
    repository.recentCommits.length > 0
      ? ["Recent commits:", ...repository.recentCommits.map((commit) => `- ${commit}`)].join("\n")
      : null
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function formatRelatedTaskForContext(task: BrainTask): string {
  return [
    `### ${task.title}`,
    `Status: ${task.status}; Type: ${task.type}; Updated: ${task.updatedAt}`,
    task.requirements.content ? `Requirements: ${truncateContext(task.requirements.content)}` : null,
    task.design.content ? `Design: ${truncateContext(task.design.content)}` : null,
    task.breakdown.content ? `Tasks: ${truncateContext(task.breakdown.content)}` : null
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function truncateContext(value: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length <= MAX_CONTEXT_SECTION_LENGTH) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, MAX_CONTEXT_SECTION_LENGTH)}...`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
