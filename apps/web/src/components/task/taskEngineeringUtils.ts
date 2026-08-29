import type { ProjectSummary } from "../../types/projects";

export function getContextProjectIds(
  projects: ProjectSummary[],
  repositoryPaths: string[]
): string[] {
  const selectedPaths = new Set(repositoryPaths);
  return projects
    .filter((project) => selectedPaths.has(project.path))
    .map((project) => project.id);
}

// Order-insensitive: the context repositories come from a multi-select, so a reordering
// is not a change. Not the same comparison as areProjectIdListsEqual in
// ProjectsDashboard, which is order-sensitive because it guards a state update.
export function haveSameProjectIdSelection(left: string[], right: string[]): boolean {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();

  return sortedLeft.length === sortedRight.length
    && sortedLeft.every((projectId, index) => projectId === sortedRight[index]);
}

export function formatTaskDate(value: string, language: string): string {
  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function getTaskErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
