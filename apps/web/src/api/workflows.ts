import type {
  WorkflowDefinition,
  WorkflowDraft,
  WorkflowListResponse,
  WorkflowRun,
  WorkflowRunInputs,
  WorkflowRunMode,
  WorkflowRunsResponse
} from "../types/workflows";
import { jsonRequest, requestJson } from "./http";

export function fetchWorkflows(): Promise<WorkflowListResponse> {
  return requestJson("/api/workflows", "Unable to load workflows");
}

export function createWorkflow(input: WorkflowDraft): Promise<WorkflowDefinition> {
  return requestJson(
    "/api/workflows",
    "Unable to create workflow",
    jsonRequest("POST", input)
  );
}

export function updateWorkflow(workflowId: string, input: WorkflowDraft): Promise<WorkflowDefinition> {
  return requestJson(
    `/api/workflows/${workflowId}`,
    "Unable to save workflow",
    jsonRequest("PUT", input)
  );
}

export function deleteWorkflow(workflowId: string): Promise<{ ok: true }> {
  return requestJson(
    `/api/workflows/${workflowId}`,
    "Unable to delete workflow",
    { method: "DELETE" }
  );
}

export function executeWorkflow(
  workflowId: string,
  mode: WorkflowRunMode,
  inputs: WorkflowRunInputs = {}
): Promise<WorkflowRun> {
  const action = mode === "dry-run" ? "dry-run" : "run";
  const fallbackMessage = mode === "dry-run"
    ? "Unable to preview workflow"
    : "Unable to execute workflow";

  return requestJson(
    `/api/workflows/${workflowId}/${action}`,
    fallbackMessage,
    jsonRequest("POST", { inputs })
  );
}

export function fetchWorkflowRuns(workflowId?: string): Promise<WorkflowRunsResponse> {
  const endpoint = workflowId ? `/api/workflows/${workflowId}/runs` : "/api/workflow-runs";
  return requestJson(endpoint, "Unable to load workflow runs");
}

export function fetchWorkflowRun(runId: string): Promise<WorkflowRun> {
  return requestJson(`/api/workflow-runs/${runId}`, "Unable to load run status");
}

export function cancelWorkflowRun(runId: string): Promise<{ ok: boolean }> {
  return requestJson(
    `/api/workflow-runs/${runId}/cancel`,
    "Unable to cancel run",
    { method: "POST" }
  );
}
