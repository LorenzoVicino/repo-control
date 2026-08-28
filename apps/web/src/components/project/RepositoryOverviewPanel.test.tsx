import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../test/render";
import type { DockerComposeProjectResponse } from "../../types/docker";
import type { GitDetails } from "../../types/git";
import type { ProjectSummary } from "../../types/projects";
import { RepositoryOverviewPanel } from "./RepositoryOverviewPanel";

vi.mock("../shared/ActionButton", () => ({
  ActionButton: ({ label }: { label: string }) => <button type="button">{label}</button>
}));

const project: ProjectSummary = {
  id: "alpha",
  name: "Alpha",
  path: "/workspace/alpha",
  branch: "main",
  isClean: false,
  staged: 1,
  modified: 2,
  untracked: 0,
  ahead: 0,
  behind: 2,
  upstream: "origin/main",
  lastCommit: { hash: "abc1234", message: "Ship overview", date: "2026-08-14T08:00:00.000Z", author: "Lorenzo" },
  hasDockerCompose: true
};

const details: GitDetails = {
  status: {
    current: "main",
    detached: false,
    isClean: false,
    tracking: "origin/main",
    ahead: 0,
    behind: 2,
    files: {
      staged: [{ path: "src/a.ts", previousPath: null, status: "staged", label: "staged" }],
      unstaged: [{ path: "src/conflict.ts", previousPath: null, status: "conflicted", label: "conflict" }]
    },
    diff: {
      staged: { files: 1, additions: 2, deletions: 0, binaryFiles: 0, untrackedFiles: 0 },
      unstaged: { files: 1, additions: 0, deletions: 0, binaryFiles: 0, untrackedFiles: 0 }
    }
  },
  branches: { current: "main", defaultBranch: "main", local: [], remote: [] },
  stashes: []
};

const dockerProject: DockerComposeProjectResponse = {
  ok: true,
  name: "alpha",
  checkedAt: "2026-08-14T09:00:00.000Z",
  error: null,
  services: [{
    name: "api",
    containerId: "api-id",
    containerName: "alpha-api-1",
    image: "alpha:api",
    state: "running",
    status: "Up",
    health: "unhealthy",
    runningFor: "1 minute",
    ports: []
  }]
};

describe("RepositoryOverviewPanel", () => {
  it("prioritizes actionable repository health and recent activity", () => {
    renderWithTheme(
      <RepositoryOverviewPanel
        project={project}
        details={details}
        commits={[{
          hash: "abc123456789",
          shortHash: "abc1234",
          author: "Lorenzo",
          date: "2026-08-14T08:00:00.000Z",
          refs: ["main"],
          message: "Ship overview"
        }]}
        dockerProject={dockerProject}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        onLoadMore={vi.fn()}
        onResult={vi.fn()}
        onCompleted={vi.fn()}
      />
    );

    expect(screen.getByText("Needs attention")).toBeVisible();
    expect(screen.getByText(/1 conflicted files are blocking/)).toBeVisible();
    expect(screen.getByText(/2 commits behind/)).toBeVisible();
    expect(screen.getByText(/1 Docker services are unhealthy/)).toBeVisible();
    expect(screen.getByText("1/1 running")).toBeVisible();
    expect(screen.getAllByText("Ship overview").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Open in VS Code" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Stop stack" })).toBeVisible();
  });

  it("uses the workspace snapshot for attention signals when live Git details are unavailable", () => {
    renderWithTheme(
      <RepositoryOverviewPanel
        project={project}
        details={undefined}
        commits={[]}
        dockerProject={undefined}
        isLoading={false}
        isLoadingMore={false}
        hasMore={false}
        onLoadMore={vi.fn()}
        onResult={vi.fn()}
        onCompleted={vi.fn()}
      />
    );

    expect(screen.getByText("Needs attention")).toBeVisible();
    expect(screen.getByText(/2 commits behind/)).toBeVisible();
    expect(screen.getByText(/2 changes are not staged yet/)).toBeVisible();
    expect(screen.queryByText("Repository in order")).not.toBeInTheDocument();
  });
});
