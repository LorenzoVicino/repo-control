import type { WorkflowRunStatus } from "../../types/workflows";

export function getWorkflowRunStatusColor(
  status: WorkflowRunStatus
): "success" | "warning" | "error" {
  if (status === "failed") return "error";
  if (status === "warning") return "warning";
  return "success";
}

export function getWorkflowRunStatusLabel(status: WorkflowRunStatus): string {
  if (status === "failed") return "Fallita";
  if (status === "warning") return "Con avvisi";
  return "Riuscita";
}
