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

export function haveSameProjectIds(left: string[], right: string[]): boolean {
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();

  return sortedLeft.length === sortedRight.length
    && sortedLeft.every((projectId, index) => projectId === sortedRight[index]);
}

export function formatTaskDate(value: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function getTaskErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Operazione non riuscita";
}
