import type { WorkflowRunStatus } from "../../types/workflows";

export function getWorkflowRunStatusColor(
  status: WorkflowRunStatus
): "success" | "warning" | "error" | "info" | "default" {
  if (status === "failed") return "error";
  if (status === "warning") return "warning";
  if (status === "pending" || status === "running") return "info";
  if (status === "cancelled" || status === "interrupted") return "default";
  return "success";
}

type WorkflowRunStatusLabelKey =
  | "failed"
  | "warning"
  | "pending"
  | "running"
  | "cancelled"
  | "interrupted"
  | "succeeded";

export function getWorkflowRunStatusLabelKey(status: WorkflowRunStatus): WorkflowRunStatusLabelKey {
  if (status === "failed") return "failed";
  if (status === "warning") return "warning";
  if (status === "pending") return "pending";
  if (status === "running") return "running";
  if (status === "cancelled") return "cancelled";
  if (status === "interrupted") return "interrupted";
  return "succeeded";
}

export function isActiveWorkflowRunStatus(status: WorkflowRunStatus): boolean {
  return status === "pending" || status === "running";
}
