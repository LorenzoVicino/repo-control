import type { TFunction } from "i18next";
import type { BrainGatePhase, BrainTaskProfile, BrainTaskStatus, BrainTaskType } from "../../types/brain";

// These arrays carry order and identity only. Every visible label is resolved from
// taskEngineering.* in the active locale, so no display text lives in this module.
export const TASK_PHASE_IDS: BrainGatePhase[] = [
  "definition",
  "requirements",
  "design",
  "breakdown",
  "implementation"
];

export const TASK_STATUS_ORDER: BrainTaskStatus[] = [
  "definition",
  "requirements",
  "design",
  "breakdown",
  "implementation",
  "done"
];

export const TASK_TYPE_IDS: BrainTaskType[] = ["feature", "fix", "refactor", "chore", "spike"];

export const TASK_PROFILE_IDS: BrainTaskProfile[] = ["lean", "full", "research"];

export const MAX_CONTEXT_REPOSITORIES = 12;

// BrainGatePhase is a subset of BrainTaskStatus, so one lookup serves both.
export function getTaskStatusLabel(t: TFunction, status: BrainTaskStatus): string {
  return t(`taskEngineering.statuses.${status}`);
}

export function getTaskTypeLabel(t: TFunction, type: BrainTaskType): string {
  return t(`taskEngineering.types.${type}`);
}

export function getTaskProfileLabel(t: TFunction, profile: BrainTaskProfile): string {
  return t(`taskEngineering.profiles.${profile}`);
}
