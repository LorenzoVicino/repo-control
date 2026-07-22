import type { BrainGatePhase, BrainTaskProfile, BrainTaskStatus, BrainTaskType } from "../../types/brain";

export const TASK_PHASES: Array<{ id: BrainGatePhase; label: string }> = [
  { id: "definition", label: "Definizione" },
  { id: "requirements", label: "Requisiti" },
  { id: "design", label: "Design" },
  { id: "breakdown", label: "Piano" },
  { id: "implementation", label: "Implementazione" }
];

export const TASK_STATUS_ORDER: BrainTaskStatus[] = [
  "definition",
  "requirements",
  "design",
  "breakdown",
  "implementation",
  "done"
];

export const MAX_CONTEXT_REPOSITORIES = 12;

export const TASK_TYPE_LABELS: Record<BrainTaskType, string> = {
  feature: "Feature",
  fix: "Fix",
  refactor: "Refactor",
  chore: "Chore",
  spike: "Spike"
};

export const TASK_PROFILE_LABELS: Record<BrainTaskProfile, string> = {
  lean: "Rapido",
  full: "Completo",
  research: "Ricerca"
};

export const TASK_STATUS_LABELS: Record<BrainTaskStatus, string> = {
  definition: "Definizione",
  requirements: "Requisiti",
  design: "Design",
  breakdown: "Piano",
  implementation: "Implementazione",
  done: "Completato"
};
