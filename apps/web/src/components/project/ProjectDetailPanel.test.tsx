import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor, within } from "@testing-library/react";
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

  it("keeps the overview visible but blocks Git tabs until unavailable details recover", async () => {
    const user = userEvent.setup();
    fetchGitDetails.mockRejectedValueOnce(new Error("Git details offline"));

    renderPanel();

    await screen.findByText(/Some live project data is unavailable|Alcuni dati live del progetto non sono disponibili/i);
    const overviewNotice = screen.getByRole("status");
    expect(overviewNotice).toHaveTextContent("Git details offline");
    expect(screen.getByText("Overview content")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: /Modifiche/ }));
    const unavailable = await screen.findByRole("alert");
    expect(unavailable).toHaveTextContent(/Git details unavailable|Dati non disponibili: Dettagli Git/i);
    expect(unavailable).toHaveTextContent("Git details offline");
    expect(screen.queryByText("Changes content")).not.toBeInTheDocument();

    await user.click(within(unavailable).getByRole("button", { name: /Retry|Riprova/i }));

    expect(await screen.findByText("Changes content")).toBeVisible();
    expect(screen.queryByText("Git details offline")).not.toBeInTheDocument();
  });

  it("surfaces Git activity failures on the overview and retries only the failed source", async () => {
    const user = userEvent.setup();
    fetchGitActivity.mockRejectedValueOnce(new Error("Git history offline"));

    renderPanel();

    await screen.findByText(/Some live project data is unavailable|Alcuni dati live del progetto non sono disponibili/i);
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(/Git activity|Attività Git/i);
    expect(notice).toHaveTextContent("Git history offline");

    await user.click(within(notice).getByRole("button", { name: /Retry|Riprova/i }));

    await waitFor(() => {
      expect(screen.queryByText("Git history offline")).not.toBeInTheDocument();
    });
    expect(fetchGitActivity).toHaveBeenCalledTimes(2);
    expect(fetchGitDetails).toHaveBeenCalledOnce();
    expect(fetchDockerComposeProject).toHaveBeenCalledOnce();
  });

  it("keeps stale Git details usable when an explicit refresh fails", async () => {
    const user = userEvent.setup();
    let failNextGitRefresh = false;
    fetchGitDetails.mockImplementation(async () => {
      if (failNextGitRefresh) {
        failNextGitRefresh = false;
        throw new Error("Git refresh offline");
      }
      return gitDetails;
    });

    renderPanel();
    await waitFor(() => expect(fetchGitDetails).toHaveBeenCalledOnce());
    failNextGitRefresh = true;
    await user.click(screen.getByRole("button", { name: "Aggiorna repository" }));

    await waitFor(() => expect(fetchGitDetails).toHaveBeenCalledTimes(2));
    await screen.findByText(/Some live project data is unavailable|Alcuni dati live del progetto non sono disponibili/i);
    expect(screen.getByRole("status")).toHaveTextContent("Git refresh offline");
    await user.click(screen.getByRole("tab", { name: /Modifiche/ }));
    const staleNotice = screen.getByRole("status");
    expect(staleNotice).toHaveTextContent("Git refresh offline");
    expect(screen.getByText("Changes content")).toBeVisible();
  });

  it("treats Docker ok-false responses as recoverable project-data failures", async () => {
    const user = userEvent.setup();
    let dockerAvailable = false;
    fetchDockerComposeProject.mockImplementation(async () => {
      if (!dockerAvailable) {
        return {
          ok: false,
          name: "alpha",
          checkedAt: "2026-08-14T09:00:00.000Z",
          error: "Docker daemon offline",
          services: []
        };
      }
      return {
        ok: true,
        name: "alpha",
        checkedAt: "2026-08-14T09:00:00.000Z",
        error: null,
        services: []
      };
    });

    renderPanel();

    await waitFor(() => expect(fetchDockerComposeProject).toHaveBeenCalledOnce());
    await screen.findByText(/Some live project data is unavailable|Alcuni dati live del progetto non sono disponibili/i);
    expect(screen.getByRole("status")).toHaveTextContent("Docker daemon offline");
    expect(screen.getByText("Overview content")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: /Docker/ }));

    const unavailable = await screen.findByRole("alert");
    expect(unavailable).toHaveTextContent(/Docker Compose status unavailable|Dati non disponibili: Stato Docker Compose/i);
    expect(unavailable).toHaveTextContent("Docker daemon offline");
    expect(screen.queryByText("Docker content")).not.toBeInTheDocument();

    dockerAvailable = true;
    await user.click(within(unavailable).getByRole("button", { name: /Retry|Riprova/i }));

    expect(await screen.findByText("Docker content")).toBeVisible();
    expect(screen.queryByText("Docker daemon offline")).not.toBeInTheDocument();
  });
});
