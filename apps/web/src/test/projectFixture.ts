import type { ProjectSummary } from "../types/projects";

export function createProjectFixture(
  id: string,
  overrides: Partial<ProjectSummary> = {}
): ProjectSummary {
  return {
    id,
    name: id,
    path: `/workspace/${id}`,
    branch: "main",
    isClean: true,
    staged: 0,
    modified: 0,
    untracked: 0,
    ahead: 0,
    behind: 0,
    upstream: "origin/main",
    lastCommit: null,
    hasDockerCompose: false,
    ...overrides
  };
}
