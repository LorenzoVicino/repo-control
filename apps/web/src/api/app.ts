import type { AppUpdateResult, AppUpdateStatus } from "../types/app";
import { requestJson } from "./http";

export function updateRepoControl(): Promise<AppUpdateResult> {
  return requestJson("/api/app/update", "Unable to update repo-control", { method: "POST" });
}

export function fetchAppUpdateStatus(): Promise<AppUpdateStatus> {
  return requestJson("/api/app/update-status", "Unable to check repo-control updates");
}
