import type {
  BrainContentPhase,
  BrainContextPreview,
  BrainGatePhase,
  BrainTask,
  BrainTaskRun,
  BrainTasksResponse,
  BrainTaskType
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
  contextProjectIds?: string[];
};

export function fetchBrainTasks(projectId: string): Promise<BrainTasksResponse> {
  return requestJson(`/api/projects/${projectId}/tasks`, "Unable to load tasks");
}

export function createBrainTask(projectId: string, input: CreateBrainTaskInput): Promise<BrainTask> {
  return requestJson(
    `/api/projects/${projectId}/tasks`,
    "Unable to create task",
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
