import type { ProjectSummary } from "../types/projects";

export function isProject(project: ProjectSummary | undefined): project is ProjectSummary {
  return project !== undefined;
}

export function getStats(projects: ProjectSummary[]) {
  return {
    total: projects.length,
    clean: projects.filter((project) => project.isClean).length,
    dirty: projects.filter((project) => !project.isClean).length,
    behind: projects.filter((project) => project.behind > 0).length,
    compose: projects.filter((project) => project.hasDockerCompose).length
  };
}

export function filterProjects(projects: ProjectSummary[], search: string): ProjectSummary[] {
  const query = search.trim().toLowerCase();

  if (!query) {
    return projects;
  }

  return projects.filter((project) =>
    [project.name, project.path, project.branch, project.upstream ?? ""].some((value) =>
      value.toLowerCase().includes(query)
    )
  );
}

export function groupProjects(projects: ProjectSummary[], root: string) {
  const groups = new Map<string, ProjectSummary[]>();

  for (const project of projects) {
    const label = getGroupLabel(project, root);
    groups.set(label, [...(groups.get(label) ?? []), project]);
  }

  return [...groups.entries()]
    .map(([label, groupProjects]) => ({
      label,
      projects: groupProjects.sort(sortProjectsForMap)
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// Only the accent colour is consumed. This previously returned a four-field tone object
// whose label, chipColor and background were all unused - and colorMode existed solely to
// pick the dead background.
export function getProjectAccentColor(project: ProjectSummary): string {
  if (!project.isClean) return "#d97706";
  if (project.behind > 0) return "#e11d48";
  if (project.ahead > 0) return "#0ea5e9";
  return "#059669";
}

export function formatDate(value: string, language?: string): string {
  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getGroupLabel(project: ProjectSummary, root: string): string {
  const normalizedRoot = root.replace(/\/+$/, "");
  const relativePath = project.path.startsWith(normalizedRoot)
    ? project.path.slice(normalizedRoot.length).replace(/^\/+/, "")
    : project.path;
  const parts = relativePath.split("/").filter(Boolean);

  return parts.length > 1 ? parts[0] : "root";
}

function sortProjectsForMap(a: ProjectSummary, b: ProjectSummary): number {
  const priorityA = getProjectPriority(a);
  const priorityB = getProjectPriority(b);

  if (priorityA !== priorityB) {
    return priorityB - priorityA;
  }

  return a.name.localeCompare(b.name);
}

function getProjectPriority(project: ProjectSummary): number {
  return Number(!project.isClean) * 4 + Number(project.behind > 0) * 3 + Number(project.ahead > 0) * 2;
}
