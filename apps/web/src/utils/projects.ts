import type { ColorMode } from "../types/common";
import type { ProjectSummary, ProjectTone } from "../types/projects";

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

export function getProjectTone(project: ProjectSummary, colorMode: ColorMode): ProjectTone {
  if (!project.isClean) {
    return {
      label: "modificato",
      chipColor: "warning",
      borderColor: "#d97706",
      background: colorMode === "light" ? "#fffbeb" : "#2a1d0b"
    };
  }

  if (project.behind > 0) {
    return {
      label: "behind",
      chipColor: "secondary",
      borderColor: "#e11d48",
      background: colorMode === "light" ? "#fff1f2" : "#2a1119"
    };
  }

  if (project.ahead > 0) {
    return {
      label: "ahead",
      chipColor: "info",
      borderColor: "#0ea5e9",
      background: colorMode === "light" ? "#f0f9ff" : "#0b2133"
    };
  }

  return {
    label: "pulito",
    chipColor: "success",
    borderColor: "#059669",
    background: colorMode === "light" ? "#ecfdf5" : "#0c251d"
  };
}

// `language` follows the app's interface language. It stays optional so callers that
// have no translation context keep the previous behaviour (the browser locale).
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
