import type { DockerContainersResponse } from "../../types/docker";
import type { ProjectSummary } from "../../types/projects";

export type DashboardChangeLoad = {
  project: ProjectSummary;
  total: number;
};

export type DashboardSnapshot = {
  total: number;
  healthy: number;
  dirty: number;
  behind: number;
  ahead: number;
  favorite: number;
  localChanges: number;
  healthPercentage: number;
  dockerAvailable: boolean;
  runningContainers: number;
  dockerGroups: number;
  changeLoad: DashboardChangeLoad[];
  recentProjects: ProjectSummary[];
};

export function buildDashboardSnapshot(
  projects: ProjectSummary[],
  favoriteProjectIds: string[],
  dockerStatus: DockerContainersResponse | undefined
): DashboardSnapshot {
  const favoriteProjectIdSet = new Set(favoriteProjectIds);
  const healthy = projects.filter((project) => project.isClean && project.behind === 0).length;
  const dirty = projects.filter((project) => !project.isClean).length;
  const behind = projects.filter((project) => project.behind > 0).length;
  const ahead = projects.filter((project) => project.ahead > 0).length;
  const favorite = projects.filter((project) => favoriteProjectIdSet.has(project.id)).length;
  const localChanges = projects.reduce((total, project) => total + getLocalChangeCount(project), 0);

  const changeLoad = projects
    .map((project) => ({ project, total: getLocalChangeCount(project) }))
    .filter((entry) => entry.total > 0)
    .sort((left, right) => right.total - left.total || left.project.name.localeCompare(right.project.name))
    .slice(0, 5);

  const recentProjects = projects
    .filter((project) => project.lastCommit !== null)
    .sort((left, right) => getCommitTimestamp(right) - getCommitTimestamp(left))
    .slice(0, 4);

  return {
    total: projects.length,
    healthy,
    dirty,
    behind,
    ahead,
    favorite,
    localChanges,
    healthPercentage: projects.length === 0 ? 0 : Math.round((healthy / projects.length) * 100),
    dockerAvailable: dockerStatus?.ok === true,
    runningContainers: dockerStatus?.ok ? dockerStatus.containers.length : 0,
    dockerGroups: dockerStatus?.ok ? dockerStatus.groups.length : 0,
    changeLoad,
    recentProjects
  };
}

function getLocalChangeCount(project: ProjectSummary): number {
  return project.staged + project.modified + project.untracked;
}

function getCommitTimestamp(project: ProjectSummary): number {
  const timestamp = Date.parse(project.lastCommit?.date ?? "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
