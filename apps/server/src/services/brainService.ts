import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { simpleGit } from "simple-git";
import { getConfigDirectory } from "../preferences.js";

export type BrainTaskType = "feature" | "bug" | "refactor" | "chore";
export type BrainTaskStatus =
  | "definition"
  | "requirements"
  | "design"
  | "breakdown"
  | "implementation"
  | "done";
export type BrainContentPhase = "requirements" | "design" | "breakdown";
export type BrainGatePhase = "definition" | BrainContentPhase | "implementation";

export type BrainPhaseState = {
  content: string;
  approvedAt: string | null;
};

export type BrainLogEntry = {
  id: string;
  kind: "note" | "fix" | "result";
  content: string;
  createdAt: string;
};

export type BrainDecision = {
  id: string;
  title: string;
  rationale: string;
  createdAt: string;
};

export type BrainTask = {
  id: string;
  title: string;
  type: BrainTaskType;
  status: BrainTaskStatus;
  definition: {
    description: string;
    motivation: string;
  };
  requirements: BrainPhaseState;
  design: BrainPhaseState;
  breakdown: BrainPhaseState;
  implementation: {
    log: BrainLogEntry[];
  };
  decisions: BrainDecision[];
  git: {
    branch: string | null;
    prUrl: string | null;
  };
  claudeSessionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BrainTasksResponse = {
  projectPath: string;
  projectName: string;
  remoteUrl: string | null;
  tasks: BrainTask[];
};

export type CreateBrainTaskInput = {
  title: string;
  type: BrainTaskType;
  definition: {
    description: string;
    motivation: string;
  };
};

export type UpdateBrainTaskInput = {
  title?: string;
  type?: BrainTaskType;
  definition?: Partial<BrainTask["definition"]>;
  phase?: BrainContentPhase;
  content?: string;
  git?: Partial<BrainTask["git"]>;
  claudeSessionId?: string | null;
};

export type AppendBrainLogInput = {
  kind: BrainLogEntry["kind"];
  content: string;
};

export type AppendBrainDecisionInput = {
  title: string;
  rationale: string;
};

type BrainFile = BrainTasksResponse & {
  version: 1;
};

export class BrainValidationError extends Error {
  statusCode = 409;
}

const MAX_RELATED_TASKS = 5;
const MAX_CONTEXT_SECTION_LENGTH = 2400;
const TASK_TYPES: BrainTaskType[] = ["feature", "bug", "refactor", "chore"];
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
    definition: input.definition,
    requirements: createEmptyPhase(),
    design: createEmptyPhase(),
    breakdown: createEmptyPhase(),
    implementation: { log: [] },
    decisions: [],
    git: { branch: null, prUrl: null },
    claudeSessionId: null,
    createdAt: now,
    updatedAt: now
  });

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
    definition: { ...task.definition },
    requirements: { ...task.requirements },
    design: { ...task.design },
    breakdown: { ...task.breakdown },
    implementation: { log: [...task.implementation.log] },
    decisions: [...task.decisions],
    git: { ...task.git },
    updatedAt: now
  };

  if (input.title !== undefined) {
    nextTask.title = normalizeText(input.title, nextTask.title).slice(0, 160);
  }

  if (input.type !== undefined) {
    nextTask.type = input.type;
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

  nextTask = normalizeBrainTask(nextTask);
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
    implementation: { log: [...task.implementation.log] },
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
      ]
    },
    updatedAt: now
  });

  brainFile.tasks = sortTasks(brainFile.tasks.map((currentTask) => (currentTask.id === taskId ? nextTask : currentTask)));
  await writeBrainFile(projectPath, brainFile);
  return nextTask;
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
    `Path: ${brainFile.projectPath}`,
    brainFile.remoteUrl ? `Remote: ${brainFile.remoteUrl}` : null,
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
    ? raw.tasks.map(normalizeBrainTask).filter((task): task is BrainTask => Boolean(task.id))
    : [];

  return {
    version: 1,
    projectPath,
    projectName,
    remoteUrl: normalizeNullableText(raw.remoteUrl, 2000),
    tasks: sortTasks(tasks)
  };
}

function normalizeBrainTask(value: unknown): BrainTask {
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

function sortTasks(tasks: BrainTask[]): BrainTask[] {
  return [...tasks].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function normalizeTaskType(value: unknown): BrainTaskType {
  return TASK_TYPES.includes(value as BrainTaskType) ? (value as BrainTaskType) : "feature";
}

function normalizeTaskStatus(value: unknown): BrainTaskStatus {
  return TASK_STATUSES.includes(value as BrainTaskStatus) ? (value as BrainTaskStatus) : "definition";
}

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() || fallback : fallback;
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
