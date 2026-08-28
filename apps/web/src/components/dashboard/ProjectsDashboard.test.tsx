import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectFixture } from "../../test/projectFixture";
import { renderWithTheme } from "../../test/render";
import type { DockerContainerGroup, DockerContainersResponse } from "../../types/docker";
import {
  fetchAppUpdateStatus,
  updateRepoControl
} from "../../api/app";
import { fetchDockerContainers, stopDockerContainers } from "../../api/docker";
import { fetchProjects, fetchProjectSummary, runProjectAction } from "../../api/projects";
import {
  fetchPreferences,
  pickWorkspaceFolder,
  setRootPath,
  updatePreferences
} from "../../api/workspace";
import { ProjectsDashboard } from "./ProjectsDashboard";

vi.mock("../../api/app", () => ({
  fetchAppUpdateStatus: vi.fn(),
  updateRepoControl: vi.fn()
}));
vi.mock("../../api/docker", () => ({
  fetchDockerContainers: vi.fn(),
  stopDockerContainers: vi.fn()
}));
vi.mock("../../api/projects", () => ({
  fetchProjects: vi.fn(),
  fetchProjectSummary: vi.fn(),
  fetchGitDetails: vi.fn().mockResolvedValue({
    status: {
      current: "main",
      detached: false,
      isClean: true,
      tracking: "origin/main",
      ahead: 0,
      behind: 0,
      files: { staged: [], unstaged: [] },
      diff: {
        staged: { files: 0, additions: 0, deletions: 0, binaryFiles: 0, untrackedFiles: 0 },
        unstaged: { files: 0, additions: 0, deletions: 0, binaryFiles: 0, untrackedFiles: 0 }
      }
    },
    branches: { current: "main", defaultBranch: "main", local: [], remote: [] },
    stashes: []
  }),
  fetchGitActivity: vi.fn().mockResolvedValue({ commits: [], offset: 0, limit: 6, hasMore: false, nextOffset: null }),
  runProjectAction: vi.fn(),
  runTerminalCommand: vi.fn()
}));
vi.mock("../../api/workspace", () => ({
  fetchPreferences: vi.fn(),
  pickWorkspaceFolder: vi.fn(),
  setRootPath: vi.fn(),
  updatePreferences: vi.fn()
}));
vi.mock("../../api/agentSessions", () => ({
  fetchAgentSessions: vi.fn().mockResolvedValue({
    root: "/workspace",
    agents: [
      { id: "claude", label: "Claude Code", installed: true, used: false, command: "claude", sessionCount: 0 },
      { id: "codex", label: "Codex", installed: true, used: false, command: "codex", sessionCount: 0 },
      { id: "gemini", label: "Gemini CLI", installed: false, used: false, command: "gemini", sessionCount: 0 }
    ],
    sessions: [],
    scannedAt: "2026-08-03T00:00:00.000Z",
    warnings: []
  }),
  resumeAgentSession: vi.fn()
}));
vi.mock("../../api/workflows", () => ({
  fetchWorkflows: vi.fn().mockResolvedValue({ workflows: [] }),
  createWorkflow: vi.fn(),
  updateWorkflow: vi.fn(),
  deleteWorkflow: vi.fn(),
  executeWorkflow: vi.fn(),
  fetchWorkflowRuns: vi.fn().mockResolvedValue({ runs: [] }),
  fetchWorkflowRun: vi.fn(),
  cancelWorkflowRun: vi.fn()
}));
vi.mock("../../api/brain", () => ({
  fetchBrainTasks: vi.fn().mockResolvedValue({
    projectPath: "/workspace/alpha",
    projectName: "Alpha",
    remoteUrl: null,
    tasks: []
  }),
  cancelBrainTaskPlanning: vi.fn(),
  createBrainTask: vi.fn(),
  planBrainTask: vi.fn(),
  createBrainTaskFromPlan: vi.fn(),
  updateBrainTask: vi.fn(),
  approveBrainTask: vi.fn(),
  fetchBrainContext: vi.fn(),
  runBrainTask: vi.fn()
}));
vi.mock("./AppMotionBackdrop", () => ({ AppMotionBackdrop: () => <div data-testid="motion" /> }));
vi.mock("./DashboardSidebar", () => ({
  DashboardSidebar: (props: Record<string, unknown>) => (
    <div
      data-testid="sidebar"
      data-collapsed={String(props.collapsed)}
      data-root-error={String(props.rootError)}
      data-scanning={String(props.isScanningRoot)}
    >
      {["overview", "tasks", "agents", "automations", "docker", "favorites", "repositories", "settings"].map((section) => (
        <button key={section} onClick={() => (props.onNavigate as (value: string) => void)(section)}>
          nav-{section}
        </button>
      ))}
      <button onClick={props.onToggleCollapsed as () => void}>toggle-sidebar</button>
      <button onClick={props.onCloseMobile as () => void}>close-mobile</button>
      <button onClick={props.onPickWorkspace as () => void}>pick-workspace</button>
      <button onClick={() => (props.onColorPaletteChange as (value: string) => void)("blue")}>palette-blue</button>
    </div>
  )
}));
vi.mock("./DashboardAppBar", () => ({
  DashboardAppBar: (props: Record<string, unknown>) => (
    <div data-testid="appbar" data-section={String(props.activeSection)} data-project={String(props.activeProjectName)}>
      <button onClick={props.onOpenMobileNavigation as () => void}>open-mobile</button>
      <button onClick={props.onOpenSearch as () => void}>open-search</button>
      <button onClick={props.onUpdateApp as () => void}>update-app</button>
      <button onClick={() => (props.onViewModeChange as (value: string) => void)("table")}>view-table</button>
      <button onClick={props.onRefreshProjects as () => void}>refresh-projects</button>
    </div>
  )
}));
vi.mock("./DashboardHome", () => ({
  DashboardHome: (props: Record<string, unknown>) => (
    <div data-testid="home">
      <button onClick={() => (props.onNavigate as (value: string) => void)("repositories")}>home-repositories</button>
      <button onClick={() => (props.onOpenProject as (value: string) => void)("alpha")}>home-open-alpha</button>
    </div>
  )
}));
vi.mock("./ControlCenter", () => ({
  ControlCenter: (props: Record<string, unknown>) => {
    const status = props.dockerStatus as DockerContainersResponse;
    return (
      <div data-testid="control-center" data-error={String(props.dockerActionError)}>
        <button onClick={props.onRefreshDocker as () => void}>docker-refresh</button>
        <button onClick={() => (props.onStopDockerGroup as (group: DockerContainerGroup) => void)(status.groups[0]!)}>
          docker-stop
        </button>
      </div>
    );
  }
}));
vi.mock("./WorkspaceMap", () => ({
  WorkspaceMap: (props: Record<string, unknown>) => (
    <div
      data-testid="workspace-map"
      data-density={String(props.density)}
      data-favorites={(props.favoriteProjectIds as string[]).join(",")}
    >
      <button onClick={() => (props.onSelectProject as (id: string) => void)("alpha")}>map-open-alpha</button>
      <button onClick={() => (props.onToggleFavorite as (id: string) => void)("beta")}>map-favorite-beta</button>
    </div>
  ),
  FavoriteProjects: (props: Record<string, unknown>) => (
    <div
      data-testid="favorites"
      data-density={String(props.density)}
      data-favorites={(props.favoriteProjectIds as string[]).join(",")}
    >
      <button onClick={() => (props.onSelectProject as (id: string) => void)("alpha")}>favorite-open-alpha</button>
      <button onClick={() => (props.onToggleFavorite as (id: string) => void)("alpha")}>favorite-toggle-alpha</button>
      <button onClick={() => (props.onDensityChange as (density: string) => void)("compact")}>favorite-density-compact</button>
    </div>
  )
}));
vi.mock("./ProjectTable", () => ({
  ProjectTable: (props: Record<string, unknown>) => (
    <button data-testid="project-table" onClick={() => (props.onSelectProject as (id: string) => void)("beta")}>
      table-open-beta
    </button>
  )
}));
vi.mock("./RepositoryCommandPalette", () => ({
  RepositoryCommandPalette: (props: Record<string, unknown>) => (
    <div data-testid="command-palette" data-open={String(props.open)} data-query={String(props.query)}>
      <button onClick={props.onClose as () => void}>palette-close</button>
      <button onClick={() => (props.onQueryChange as (value: string) => void)("beta")}>palette-query-beta</button>
      <button onClick={() => (props.onOpenProject as (id: string) => void)("beta")}>palette-open-beta</button>
    </div>
  )
}));
vi.mock("../project/ProjectWorkspaceTabs", () => ({
  ProjectWorkspaceTabs: (props: Record<string, unknown>) => (
    <div data-testid="project-tabs">
      <button onClick={() => (props.onActiveProjectChange as (id: string) => void)("alpha")}>activate-alpha</button>
      <button onClick={() => (props.onActiveProjectChange as (id: string) => void)("beta")}>activate-beta</button>
      <button onClick={() => (props.onCloseProject as (id: string) => void)("alpha")}>close-alpha</button>
      <button onClick={() => (props.onCloseProject as (id: string) => void)("beta")}>close-beta</button>
    </div>
  )
}));
vi.mock("../agents/AgentSessionsPage", () => ({ AgentSessionsPage: () => <div data-testid="agents-page" /> }));
vi.mock("../automation/AutomationPage", () => ({ AutomationPage: () => <div data-testid="automation-page" /> }));
vi.mock("../task/TaskEngineeringPage", () => ({ TaskEngineeringPage: () => <div data-testid="tasks-page" /> }));
vi.mock("../settings/SettingsPage", () => ({ SettingsPage: () => <div data-testid="settings-page" /> }));
vi.mock("./AppUpdateDialog", () => ({
  AppUpdateDialog: (props: Record<string, unknown>) => (
    <div data-testid="update-dialog" data-open={String(props.open)} data-result={String(Boolean(props.result))}>
      <button onClick={props.onClose as () => void}>close-update</button>
    </div>
  )
}));

const alpha = createProjectFixture("alpha", { name: "Alpha", path: "/workspace/alpha" });
const beta = createProjectFixture("beta", { name: "Beta", path: "/workspace/beta", isClean: false });
const dockerGroup: DockerContainerGroup = {
  id: "compose:alpha",
  name: "alpha",
  composeProject: "alpha",
  workingDir: "/workspace/alpha",
  containers: [{
    id: "container-alpha",
    name: "alpha-web",
    image: "alpha:latest",
    status: "Up",
    ports: "",
    runningFor: "1 minute",
    composeProject: "alpha",
    composeService: "web",
    composeWorkingDir: "/workspace/alpha"
  }]
};
const dockerStatus: DockerContainersResponse = {
  ok: true,
  containers: dockerGroup.containers,
  groups: [dockerGroup],
  checkedAt: "2026-08-03T00:00:00.000Z",
  error: null
};

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, gcTime: Infinity }
    }
  });
  const onColorPaletteChange = vi.fn();
  const view = renderWithTheme(
    <QueryClientProvider client={queryClient}>
      <ProjectsDashboard colorPalette="white" onColorPaletteChange={onColorPaletteChange} />
    </QueryClientProvider>
  );
  return { ...view, queryClient, onColorPaletteChange };
}

describe("ProjectsDashboard orchestration", () => {
  beforeEach(() => {
    vi.stubGlobal("scrollTo", vi.fn());
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.mocked(fetchProjects).mockResolvedValue({ root: "/workspace", projects: [alpha, beta] });
    vi.mocked(fetchProjectSummary).mockImplementation(async (id) => id === "alpha" ? { ...alpha, ahead: 1 } : beta);
    vi.mocked(runProjectAction).mockResolvedValue({
      ok: true,
      command: "git fetch",
      exitCode: 0,
      stdout: "",
      stderr: "",
      output: "",
      durationMs: 1
    });
    vi.mocked(fetchDockerContainers).mockResolvedValue(dockerStatus);
    vi.mocked(fetchPreferences).mockResolvedValue({ favoriteProjectIds: ["alpha"] });
    vi.mocked(fetchAppUpdateStatus).mockResolvedValue({
      currentVersion: "0.5.0",
      latestVersion: "0.6.0",
      updateAvailable: true,
      checkedAt: "2026-08-03T00:00:00.000Z",
      error: null
    });
    vi.mocked(updatePreferences).mockResolvedValue({ favoriteProjectIds: [] });
    vi.mocked(pickWorkspaceFolder).mockResolvedValue(null);
    vi.mocked(setRootPath).mockResolvedValue({ root: "/new-workspace" });
    vi.mocked(updateRepoControl).mockResolvedValue({
      ok: true,
      command: "git pull",
      exitCode: 0,
      stdout: "ok",
      stderr: "",
      output: "ok",
      durationMs: 1,
      restartScheduled: false
    });
    vi.mocked(stopDockerContainers).mockResolvedValue({
      ok: true,
      command: "docker stop",
      exitCode: 0,
      stdout: "",
      stderr: "",
      output: "",
      durationMs: 1
    });
  });

  it("walks every main section and successful action", async () => {
    const user = userEvent.setup();
    const { queryClient, onColorPaletteChange } = renderDashboard();
    expect(await screen.findByTestId("home")).toBeVisible();

    await user.click(screen.getByText("toggle-sidebar"));
    expect(screen.getByTestId("sidebar")).toHaveAttribute("data-collapsed", "true");
    await user.click(screen.getByText("palette-blue"));
    expect(onColorPaletteChange).toHaveBeenCalledWith("blue");
    await user.click(screen.getByText("open-mobile"));
    await user.click(screen.getByText("close-mobile"));

    await user.click(screen.getByText("nav-favorites"));
    expect(await screen.findByTestId("favorites")).toBeVisible();
    expect(screen.getByTestId("favorites")).toHaveAttribute("data-density", "comfortable");
    await user.click(screen.getByText("favorite-density-compact"));
    expect(screen.getByTestId("favorites")).toHaveAttribute("data-density", "compact");
    await user.click(screen.getByText("favorite-toggle-alpha"));
    expect(updatePreferences).toHaveBeenCalled();

    await user.click(screen.getByText("nav-repositories"));
    expect(await screen.findByTestId("workspace-map")).toBeVisible();
    expect(screen.getByTestId("workspace-map")).toHaveAttribute("data-density", "compact");
    await user.click(screen.getByText("map-favorite-beta"));
    await user.click(screen.getByText("view-table"));
    expect(await screen.findByTestId("project-table")).toBeVisible();
    await user.click(screen.getByText("table-open-beta"));
    const betaDetail = await screen.findByLabelText(
      "Dettaglio repository Beta",
      {},
      { timeout: 10_000 }
    );
    expect(betaDetail).toBeVisible();
    await user.click(within(betaDetail).getByRole("button", { name: /preferiti/ }));

    await user.click(screen.getByText("close-beta"));
    await user.click(screen.getByText("nav-overview"));
    await user.click(await screen.findByText("home-open-alpha"));
    await user.click(screen.getByText("open-search"));
    await user.click(screen.getByText("palette-open-beta"));
    await user.click(screen.getByText("activate-alpha"));
    await user.click(screen.getByText("close-alpha"));
    await user.click(screen.getByText("close-beta"));

    await user.click(screen.getByText("nav-agents"));
    expect(screen.getByTestId("appbar")).toHaveAttribute("data-section", "agents");
    await user.click(screen.getByText("nav-automations"));
    expect(screen.getByTestId("appbar")).toHaveAttribute("data-section", "automations");
    await user.click(screen.getByText("nav-tasks"));
    expect(screen.getByTestId("appbar")).toHaveAttribute("data-section", "tasks");
    await user.click(screen.getByText("nav-settings"));
    expect(screen.getByTestId("settings-page")).toBeVisible();

    await user.click(screen.getByText("nav-docker"));
    expect(await screen.findByTestId("control-center")).toBeVisible();
    await user.click(screen.getByText("docker-refresh"));
    await user.click(screen.getByText("docker-stop"));
    expect(stopDockerContainers).toHaveBeenCalledWith(["container-alpha"]);

    await user.click(screen.getByText("update-app"));
    expect(updateRepoControl).toHaveBeenCalledOnce();
    expect(screen.getByTestId("update-dialog")).toHaveAttribute("data-result", "true");
    await user.click(screen.getByText("close-update"));

    vi.mocked(pickWorkspaceFolder).mockResolvedValueOnce("/new-workspace");
    await user.click(screen.getByText("pick-workspace"));
    expect(setRootPath).toHaveBeenCalledWith("/new-workspace");
    await user.keyboard("{Control>}p{/Control}");
    expect(screen.getByTestId("command-palette")).toHaveAttribute("data-open", "true");
    await user.click(screen.getByText("palette-query-beta"));
    expect(screen.getByTestId("command-palette")).toHaveAttribute("data-query", "beta");
    await user.click(screen.getByText("palette-close"));

    await act(async () => {
      queryClient.setQueryData(["projects"], { root: "/workspace", projects: [alpha] });
    });
    expect(screen.getByTestId("sidebar")).toBeVisible();
  }, 20_000);

  it("surfaces and recovers from external action failures", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("repo-control-favorite-projects", "[\"beta\", 3]");
    vi.mocked(fetchPreferences).mockResolvedValueOnce({ favoriteProjectIds: [] });
    vi.mocked(updatePreferences)
      .mockResolvedValueOnce({ favoriteProjectIds: ["beta"] })
      .mockRejectedValue(new Error("preferences offline"));
    vi.mocked(pickWorkspaceFolder)
      .mockRejectedValueOnce(new Error("picker denied"))
      .mockRejectedValueOnce("picker failed");
    vi.mocked(updateRepoControl).mockRejectedValue(new Error("update failed"));
    vi.mocked(stopDockerContainers).mockRejectedValue("docker failed");
    vi.mocked(fetchProjectSummary).mockRejectedValue(new Error("git failed"));

    renderDashboard();
    expect(await screen.findByTestId("home")).toBeVisible();
    expect(updatePreferences).toHaveBeenCalledWith({ favoriteProjectIds: ["beta"] });

    await user.click(screen.getByText("pick-workspace"));
    expect(screen.getByTestId("sidebar")).toHaveAttribute("data-root-error", "picker denied");
    await user.click(screen.getByText("pick-workspace"));
    expect(screen.getByTestId("sidebar")).toHaveAttribute("data-root-error", "Unable to pick folder");

    await user.click(screen.getByText("update-app"));
    expect(screen.getByTestId("update-dialog")).toHaveAttribute("data-result", "true");

    await user.click(screen.getByText("nav-repositories"));
    await user.click(await screen.findByText("map-open-alpha"));
    const alphaDetail = await screen.findByLabelText(
      "Dettaglio repository Alpha",
      {},
      { timeout: 10_000 }
    );
    await user.click(within(alphaDetail).getByRole("button", { name: /preferiti/ }));

    await user.click(screen.getByText("nav-docker"));
    await user.click(await screen.findByText("docker-stop"));
    expect(screen.getByTestId("control-center")).toHaveAttribute("data-error", "Unable to stop Docker containers");
  }, 20_000);

  it("shows a busy workspace skeleton until the initial project scan completes", async () => {
    let finishScan: ((value: { root: string; projects: [typeof alpha, typeof beta] }) => void) | undefined;
    vi.mocked(fetchProjects).mockImplementationOnce(() => new Promise((resolve) => {
      finishScan = resolve;
    }));

    renderDashboard();

    expect(await screen.findByRole("status", { name: /Scanning workspace|Scansione workspace/i })).toBeVisible();
    expect(screen.queryByTestId("home")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      finishScan?.({ root: "/workspace", projects: [alpha, beta] });
    });

    expect(await screen.findByTestId("home")).toBeVisible();
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "false");
  });

  it("blocks false healthy content when the initial workspace request fails and recovers on retry", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchProjects).mockRejectedValueOnce(new Error("workspace offline"));

    renderDashboard();

    const failure = await screen.findByRole("alert");
    expect(failure).toHaveTextContent(/Workspace data is unavailable|Dati del workspace non disponibili/i);
    expect(failure).toHaveTextContent("workspace offline");
    expect(screen.queryByTestId("home")).not.toBeInTheDocument();

    await user.click(within(failure).getByRole("button", { name: /Retry|Riprova/i }));

    expect(await screen.findByTestId("home")).toBeVisible();
    expect(screen.queryByText("workspace offline")).not.toBeInTheDocument();
  });

  it("keeps the last valid workspace visible when a refresh fails and clears the stale warning on retry", async () => {
    const user = userEvent.setup();
    renderDashboard();
    expect(await screen.findByTestId("home")).toBeVisible();

    vi.mocked(fetchProjects).mockRejectedValueOnce(new Error("refresh offline"));
    await user.click(screen.getByText("refresh-projects"));

    await screen.findByText(/Workspace refresh failed|Aggiornamento workspace non riuscito/i);
    const staleNotice = screen.getByRole("status");
    expect(staleNotice).toHaveTextContent("refresh offline");
    expect(screen.getByTestId("home")).toBeVisible();

    await user.click(within(staleNotice).getByRole("button", { name: /Retry|Riprova/i }));

    await waitFor(() => {
      expect(screen.queryByText("refresh offline")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("home")).toBeVisible();
  });

  it("keeps a newly selected workspace blocked until one of its retries succeeds", async () => {
    const user = userEvent.setup();
    renderDashboard();
    expect(await screen.findByTestId("home")).toBeVisible();

    vi.mocked(pickWorkspaceFolder).mockResolvedValueOnce("/new-workspace");
    vi.mocked(fetchProjects)
      .mockRejectedValueOnce(new Error("new workspace offline"))
      .mockRejectedValueOnce(new Error("new workspace still offline"));
    await user.click(screen.getByText("pick-workspace"));

    const failure = await screen.findByRole("alert");
    expect(failure).toHaveTextContent("new workspace offline");
    expect(screen.queryByTestId("home")).not.toBeInTheDocument();

    await user.click(within(failure).getByRole("button", { name: /Retry|Riprova/i }));
    await waitFor(() => {
      expect(failure).toHaveTextContent("new workspace still offline");
    });
    expect(screen.queryByTestId("home")).not.toBeInTheDocument();

    await user.click(within(failure).getByRole("button", { name: /Retry|Riprova/i }));
    expect(await screen.findByTestId("home")).toBeVisible();
  });

  it("restores the last confirmed favorites when a favorite save fails and recovers on retry", async () => {
    const user = userEvent.setup();
    renderDashboard();
    expect(await screen.findByTestId("home")).toBeVisible();

    await user.click(screen.getByText("nav-favorites"));
    expect(await screen.findByTestId("favorites")).toHaveAttribute("data-favorites", "alpha");

    vi.mocked(updatePreferences).mockRejectedValueOnce(new Error("preferences offline"));
    await user.click(screen.getByText("favorite-toggle-alpha"));

    const failure = await screen.findByRole("alert");
    expect(failure).toHaveTextContent(/Favorite change was not saved|Modifica ai preferiti non salvata/i);
    expect(failure).toHaveTextContent("preferences offline");
    await waitFor(() => {
      expect(screen.getByTestId("favorites")).toHaveAttribute("data-favorites", "alpha");
    });

    await user.click(within(failure).getByRole("button", { name: /Retry|Riprova/i }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("favorites")).toHaveAttribute("data-favorites", "");
  });

  it("pauses favorite changes while saved preferences are unavailable and recovers on retry", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchPreferences).mockRejectedValueOnce(new Error("preferences unreachable"));
    renderDashboard();
    expect(await screen.findByTestId("home")).toBeVisible();

    const failure = await screen.findByRole("alert");
    expect(failure).toHaveTextContent(/Favorites unavailable|Preferiti non disponibili/i);
    expect(failure).toHaveTextContent("preferences unreachable");

    const savesBeforeToggle = vi.mocked(updatePreferences).mock.calls.length;
    await user.click(screen.getByText("nav-favorites"));
    await user.click(await screen.findByText("favorite-toggle-alpha"));
    expect(vi.mocked(updatePreferences).mock.calls).toHaveLength(savesBeforeToggle);

    await user.click(within(failure).getByRole("button", { name: /Retry|Riprova/i }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    expect(await screen.findByTestId("favorites")).toHaveAttribute("data-favorites", "alpha");
  });

  it("announces project action failures and retains their command output in operation history", async () => {
    const user = userEvent.setup();
    vi.mocked(runProjectAction).mockResolvedValueOnce({
      ok: false,
      command: "git fetch",
      exitCode: 1,
      stdout: "",
      stderr: "network offline",
      output: "network offline",
      durationMs: 42
    });
    renderDashboard();
    expect(await screen.findByTestId("home")).toBeVisible();

    await user.click(screen.getByText("nav-repositories"));
    await user.click(await screen.findByText("map-open-alpha"));
    await user.click(await screen.findByRole("tab", { name: /^Branch/i }));
    await user.click(await screen.findByRole("button", { name: "Fetch" }));

    const notification = await screen.findByRole("alert");
    expect(notification).toHaveTextContent(/Failed|non riuscita/i);
    expect(notification).toHaveTextContent("Alpha");
    expect(notification).toHaveTextContent("git fetch");
    expect(screen.getByRole("button", { name: /Open operation history|Apri cronologia operazioni/i })).toBeVisible();

    await user.click(within(notification).getByRole("button", { name: /Details|Dettagli/i }));

    const dialog = await screen.findByRole("dialog", { name: /Operation history|Cronologia operazioni/i });
    expect(dialog).toHaveTextContent("network offline");
    expect(dialog).toHaveTextContent("git fetch");
    expect(dialog).toHaveTextContent("1");
  });

  it("reports the workspace scan phase and cancels stale project data", async () => {
    const user = userEvent.setup();
    let finishScan: ((value: { root: string; projects: [] }) => void) | undefined;

    renderDashboard();
    expect(await screen.findByTestId("home")).toBeVisible();

    vi.mocked(pickWorkspaceFolder).mockResolvedValueOnce("/new-workspace");
    vi.mocked(fetchProjects).mockImplementationOnce(() => new Promise((resolve) => {
      finishScan = resolve;
    }));

    await user.click(screen.getByText("pick-workspace"));
    await waitFor(() => {
      expect(screen.getByTestId("sidebar")).toHaveAttribute("data-scanning", "true");
    });
    expect(screen.queryByTestId("home")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Scanning workspace…" })).toBeVisible();

    await act(async () => {
      finishScan?.({ root: "/new-workspace", projects: [] });
    });
    await waitFor(() => {
      expect(screen.getByTestId("sidebar")).toHaveAttribute("data-scanning", "false");
    });
    expect(setRootPath).toHaveBeenCalledWith("/new-workspace");
    expect(await screen.findByTestId("home")).toBeVisible();
    expect(screen.queryByRole("status", { name: "Scanning workspace…" })).not.toBeInTheDocument();
  });

  it("shows a shimmering skeleton in place of the repository grid while a scan is in flight", async () => {
    const user = userEvent.setup();
    let finishScan: ((value: { root: string; projects: [] }) => void) | undefined;

    renderDashboard();
    await user.click(screen.getByText("nav-repositories"));
    expect(await screen.findByTestId("workspace-map")).toBeVisible();

    vi.mocked(pickWorkspaceFolder).mockResolvedValueOnce("/new-workspace");
    vi.mocked(fetchProjects).mockImplementationOnce(() => new Promise((resolve) => {
      finishScan = resolve;
    }));

    await user.click(screen.getByText("pick-workspace"));
    await waitFor(() => {
      expect(screen.queryByTestId("workspace-map")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("status", { name: "Scanning workspace…" })).toBeVisible();

    await act(async () => {
      finishScan?.({ root: "/new-workspace", projects: [] });
    });
    expect(await screen.findByTestId("workspace-map")).toBeVisible();
    expect(screen.queryByRole("status", { name: "Scanning workspace…" })).not.toBeInTheDocument();
  });
});
