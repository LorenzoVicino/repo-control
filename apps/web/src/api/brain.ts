import type {
  BrainContentPhase,
  BrainContextPreview,
  BrainGatePhase,
  BrainTask,
  BrainTaskProfile,
  BrainTaskRun,
  BrainTasksResponse,
  BrainTaskType,
  TaskPlanDraft
} from "../types/brain";
import { jsonRequest, requestJson } from "./http";

export type CreateBrainTaskInput = {
  title: string;
  type: BrainTaskType;
  description: string;
  motivation: string;
  contextProjectIds?: string[];
};

export type UpdateBrainTaskInput = {
  title?: string;
  type?: BrainTaskType;
  definition?: { description?: string; motivation?: string };
  phase?: BrainContentPhase;
  content?: string;
  verificationChecks?: string[];
  contextProjectIds?: string[];
};

export type PlanBrainTaskInput = {
  requestId: string;
  brief: string;
  profile: BrainTaskProfile | "auto";
  contextProjectIds?: string[];
  feedback?: string;
  answers?: Record<string, string>;
  currentDraft?: TaskPlanDraft;
};

export type CreateBrainTaskFromPlanInput = {
  title: string;
  type: BrainTaskType;
  profile: BrainTaskProfile;
  brief: string;
  description: string;
  motivation: string;
  requirements: string;
  design: string;
  breakdown: string;
  checks: string[];
  assumptions: string[];
  provider: "claude";
  generatedAt: string;
  sessionId: string | null;
  contextProjectIds?: string[];
  clarifications: Array<{ question: string; answer: string }>;
};

export function fetchBrainTasks(projectId: string): Promise<BrainTasksResponse> {
  return requestJson(`/api/projects/${projectId}/tasks`, "Unable to load tasks");
}

export function cancelBrainTaskPlanning(projectId: string, requestId: string): Promise<{ ok: boolean }> {
  return requestJson(
    `/api/projects/${projectId}/tasks/plan/cancel`,
    "Unable to cancel task planning",
    jsonRequest("POST", { requestId })
  );
}

export function createBrainTask(projectId: string, input: CreateBrainTaskInput): Promise<BrainTask> {
  return requestJson(
    `/api/projects/${projectId}/tasks`,
    "Unable to create task",
    jsonRequest("POST", input)
  );
}

export function planBrainTask(
  projectId: string,
  input: PlanBrainTaskInput,
  signal?: AbortSignal
): Promise<TaskPlanDraft> {
  return requestJson(
    `/api/projects/${projectId}/tasks/plan`,
    "Unable to prepare task plan",
    { ...jsonRequest("POST", input), signal }
  );
}

export function createBrainTaskFromPlan(
  projectId: string,
  input: CreateBrainTaskFromPlanInput
): Promise<BrainTask> {
  return requestJson(
    `/api/projects/${projectId}/tasks/from-plan`,
    "Unable to create planned task",
    jsonRequest("POST", input)
  );
}

export function updateBrainTask(
  projectId: string,
  taskId: string,
  input: UpdateBrainTaskInput
): Promise<BrainTask> {
  return requestJson(
    `/api/projects/${projectId}/tasks/${taskId}`,
    "Unable to save task",
    jsonRequest("PUT", input)
  );
}

export function approveBrainTask(
  projectId: string,
  taskId: string,
  phase: BrainGatePhase
): Promise<BrainTask> {
  return requestJson(
    `/api/projects/${projectId}/tasks/${taskId}/approve`,
    "Unable to approve task phase",
    jsonRequest("POST", { phase })
  );
}

export function fetchBrainContext(projectId: string, taskId: string): Promise<BrainContextPreview> {
  return requestJson(
    `/api/projects/${projectId}/tasks/${taskId}/context`,
    "Unable to assemble brain context"
  );
}

export function runBrainTask(
  projectId: string,
  taskId: string,
  input: { prompt: string; checks: string[] }
): Promise<BrainTaskRun> {
  return requestJson(
    `/api/projects/${projectId}/tasks/${taskId}/runs`,
    "Engineering run failed",
    jsonRequest("POST", input)
  );
}
