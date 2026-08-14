import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../test/render";
import { createProjectFixture } from "../../test/projectFixture";
import { ProjectDetailPanel } from "./ProjectDetailPanel";

const fetchGitDetails = vi.fn();
const fetchGitActivity = vi.fn();
const fetchDockerComposeProject = vi.fn();

vi.mock("../../api/projects", () => ({
  fetchGitDetails: (...args: unknown[]) => fetchGitDetails(...args),
  fetchGitActivity: (...args: unknown[]) => fetchGitActivity(...args)
}));

vi.mock("../../api/docker", () => ({
  fetchDockerComposeProject: (...args: unknown[]) => fetchDockerComposeProject(...args)
}));

vi.mock("./RepositoryOverviewPanel", () => ({
  RepositoryOverviewPanel: () => <div>Overview content</div>
}));

vi.mock("./ChangesPanel", () => ({
  ChangesPanel: () => <div>Changes content</div>
}));

vi.mock("./BranchesPanel", () => ({
  BranchesPanel: () => <div>Branches content</div>
}));

vi.mock("./DockerDetailPanel", () => ({
  DockerDetailPanel: () => <div>Docker content</div>
}));

vi.mock("./TerminalPanel", () => ({
  TerminalPanel: () => {
    const [count, setCount] = React.useState(0);
    return <button type="button" onClick={() => setCount((value) => value + 1)}>Terminal state {count}</button>;
  }
}));

const gitDetails = {
  status: {
    current: "main",
    detached: false,
    isClean: false,
    tracking: "origin/main",
    ahead: 0,
    behind: 1,
    files: {
      staged: [{ path: "src/a.ts", previousPath: null, status: "staged", label: "staged" }],
      unstaged: []
    },
    diff: {
      staged: { files: 1, additions: 1, deletions: 0, binaryFiles: 0, untrackedFiles: 0 },
      unstaged: { files: 0, additions: 0, deletions: 0, binaryFiles: 0, untrackedFiles: 0 }
    }
  },
  branches: { current: "main", defaultBranch: "main", local: [], remote: [] },
  stashes: []
};

function renderPanel(hasDockerCompose = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return renderWithTheme(
    <QueryClientProvider client={client}>
      <ProjectDetailPanel
        project={createProjectFixture("alpha", { name: "Alpha", hasDockerCompose, modified: 1, behind: 1 })}
        isActive
        isFavorite={false}
        onToggleFavorite={vi.fn()}
        onResult={vi.fn()}
        onRefresh={vi.fn()}
      />
    </QueryClientProvider>
  );
}

describe("ProjectDetailPanel", () => {
  beforeEach(() => {
    fetchGitDetails.mockReset();
    fetchGitActivity.mockReset();
    fetchDockerComposeProject.mockReset();
    fetchGitDetails.mockResolvedValue(gitDetails);
    fetchGitActivity.mockResolvedValue({ commits: [], offset: 0, limit: 6, hasMore: false, nextOffset: null });
    fetchDockerComposeProject.mockResolvedValue({
      ok: true,
      name: "alpha",
      checkedAt: "2026-08-14T09:00:00.000Z",
      error: null,
      services: []
    });
  });

  it("uses Overview as the full-width landing, removes Deploy and preserves Terminal state", async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByText("Overview content")).toBeVisible();
    expect(screen.queryByRole("tab", { name: /Deploy/ })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Docker/ })).toBeVisible();

    await user.click(screen.getByRole("tab", { name: /Terminale/ }));
    await user.click(screen.getByRole("button", { name: "Terminal state 0" }));
    expect(screen.getByRole("button", { name: "Terminal state 1" })).toBeVisible();
    await user.click(screen.getByRole("tab", { name: /Modifiche/ }));
    expect(screen.getByText("Changes content")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: /Terminale/ }));
    expect(screen.getByRole("button", { name: "Terminal state 1" })).toBeVisible();

    await waitFor(() => expect(fetchGitDetails).toHaveBeenCalledWith("alpha"));
  });

  it("hides Docker when the repository has no Compose capability", () => {
    renderPanel(false);
    expect(screen.queryByRole("tab", { name: /Docker/ })).not.toBeInTheDocument();
  });
});
