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

export function getWorkflowRunStatusLabel(status: WorkflowRunStatus): string {
  if (status === "failed") return "Fallita";
  if (status === "warning") return "Con avvisi";
  if (status === "pending") return "In coda";
  if (status === "running") return "In corso";
  if (status === "cancelled") return "Annullata";
  if (status === "interrupted") return "Interrotta";
  return "Riuscita";
}

export function isActiveWorkflowRunStatus(status: WorkflowRunStatus): boolean {
  return status === "pending" || status === "running";
}
