import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createProjectFixture } from "../../test/projectFixture";
import { renderWithProviders } from "../../test/render";
import type { DockerContainersResponse } from "../../types/docker";
import { DashboardHome } from "./DashboardHome";
import { DEFAULT_DASHBOARD_LAYOUT, type DashboardLayout } from "./dashboardLayout";

vi.mock("../../api/agentSessions", () => ({
  fetchAgentSessions: vi.fn().mockResolvedValue({
    root: "/workspace",
    agents: [
      { id: "claude", label: "Claude Code", installed: true, used: true, command: "claude", sessionCount: 1 },
      { id: "codex", label: "Codex", installed: false, used: false, command: "codex", sessionCount: 0 },
      { id: "gemini", label: "Gemini CLI", installed: false, used: false, command: "gemini", sessionCount: 0 }
    ],
    sessions: [{
      id: "session-1",
      provider: "claude",
      providerLabel: "Claude Code",
      projectId: "billing",
      projectName: "billing-events-consumer",
      projectPath: "/workspace/billing",
      title: "Retry failed workflow runs",
      preview: null,
      branch: "main",
      startedAt: "2026-09-02T08:00:00.000Z",
      updatedAt: "2026-09-02T09:30:00.000Z",
      match: null
    }],
    scannedAt: "2026-09-02T10:00:00.000Z",
    warnings: []
  }),
  resumeAgentSession: vi.fn().mockResolvedValue({ ok: true, message: "Terminal opened", command: "claude --resume" })
}));

vi.mock("../../api/workflows", () => ({
  fetchWorkflows: vi.fn().mockResolvedValue({
    workflows: [{ id: "workflow-1", name: "Nightly fetch", description: "", nodes: [], edges: [], createdAt: "", updatedAt: "" }]
  }),
  fetchWorkflowRuns: vi.fn().mockResolvedValue({
    runs: [{
      id: "run-1",
      workflowId: "workflow-1",
      workflowName: "Nightly fetch",
      mode: "run",
      status: "interrupted",
      startedAt: "2026-09-02T07:00:00.000Z",
      completedAt: "2026-09-02T07:00:05.000Z",
      durationMs: 5000,
      steps: [],
      summary: { selectedProjects: 2, succeeded: 0, failed: 0, skipped: 0, commands: 0 },
      statusMessage: null
    }]
  })
}));

const dockerStatus: DockerContainersResponse = {
  ok: true,
  checkedAt: "2026-09-02T10:00:00.000Z",
  error: null,
  containers: [
    { id: "c1", name: "billing-api", image: "api", status: "Up 2 minutes (unhealthy)", ports: "", runningFor: "2 minutes", composeProject: "billing", composeService: "api", composeWorkingDir: "/workspace/billing" }
  ],
  groups: [{
    id: "billing",
    name: "billing",
    composeProject: "billing",
    workingDir: "/workspace/billing",
    containers: [
      { id: "c1", name: "billing-api", image: "api", status: "Up 2 minutes (unhealthy)", ports: "", runningFor: "2 minutes", composeProject: "billing", composeService: "api", composeWorkingDir: "/workspace/billing" }
    ]
  }]
};

const projects = [
  createProjectFixture("billing", {
    name: "billing-events-consumer",
    path: "/workspace/billing",
    isClean: false,
    modified: 3,
    lastCommit: { hash: "abc", message: "fix", date: "2026-09-02T09:00:00.000Z", author: "L" }
  }),
  createProjectFixture("web", { name: "web-checkout", behind: 2 }),
  createProjectFixture("infra", { name: "platform-observability-infra", ahead: 1 })
];

function renderHome(overrides: Partial<React.ComponentProps<typeof DashboardHome>> = {}) {
  const props: React.ComponentProps<typeof DashboardHome> = {
    projects,
    favoriteProjectIds: ["infra"],
    recentProjectIds: ["web"],
    dockerStatus,
    isLoadingDocker: false,
    workspaceRoot: "/home/lorenzo/projects",
    scannedAt: Date.now(),
    isRefreshing: false,
    layout: DEFAULT_DASHBOARD_LAYOUT,
    canEditLayout: true,
    onLayoutChange: vi.fn(),
    onNavigate: vi.fn(),
    onOpenProject: vi.fn(),
    onOpenSearch: vi.fn(),
    onPickWorkspace: vi.fn(),
    onRefreshWorkspace: vi.fn(),
    ...overrides
  };
  return { ...renderWithProviders(<DashboardHome {...props} />), props };
}

describe("DashboardHome", () => {
  it("leads with what needs attention and opens the right target from every widget", async () => {
    const user = userEvent.setup();
    const { props } = renderHome();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("2 of 3 repositories need attention");

    const attention = screen.getByRole("region", { name: "Needs attention" });
    const rows = within(attention).getAllByRole("button");
    // The unhealthy container leads, then the repository that is behind, then the dirty one.
    expect(rows[0]).toHaveTextContent("billing");
    expect(rows[0]).toHaveTextContent("1 unhealthy container");
    expect(rows[1]).toHaveTextContent("web-checkout");
    expect(rows[1]).toHaveTextContent("2 commits to pull");
    await waitFor(() => expect(within(attention).getByText(/Last run was interrupted/)).toBeVisible());

    await user.click(rows[1]);
    expect(props.onOpenProject).toHaveBeenCalledWith("web");

    const resume = screen.getByRole("region", { name: "Pick up where you left off" });
    const resumeRows = within(resume).getAllByRole("button", { name: /^Open / });
    expect(resumeRows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("web-checkout"),
      expect.stringContaining("platform-observability-infra"),
      expect.stringContaining("billing-events-consumer")
    ]);

    const chats = screen.getByRole("region", { name: "AI conversations" });
    await waitFor(() => expect(within(chats).getByText("Retry failed workflow runs")).toBeVisible());
    await user.click(within(chats).getByRole("button", { name: /Resume the conversation/ }));
    await waitFor(() => expect(within(chats).getByText("Terminal opened")).toBeVisible());

    const automations = screen.getByRole("region", { name: "Automations" });
    await waitFor(() => expect(within(automations).getByText("Nightly fetch")).toBeVisible());
    expect(within(automations).getByText("Interrupted")).toBeVisible();

    await user.click(within(screen.getByRole("region", { name: "Shortcuts" })).getByRole("button", { name: /Find a repository/ }));
    expect(props.onOpenSearch).toHaveBeenCalled();
  });

  it("swaps the workspace ring readout to the state under the pointer or focus", async () => {
    const user = userEvent.setup();
    renderHome();

    const readout = screen.getByTestId("workspace-ring-readout");
    expect(readout).toHaveTextContent("3");
    const changesRow = document.querySelector('[data-legend-key="changes"]') as HTMLElement;
    await user.hover(changesRow);
    expect(readout).toHaveTextContent("1");
    expect(document.querySelector('[data-segment="changes"][data-active]')).not.toBeNull();
    await user.unhover(changesRow);
    expect(readout).toHaveTextContent("3");

    // A state at zero has no arc, so its legend row is inert.
    expect(document.querySelector('[data-legend-key="inSync"]')).not.toHaveAttribute("tabindex");
    fireEvent.focusIn(document.querySelector('[data-legend-key="behind"]') as HTMLElement);
    expect(readout).toHaveTextContent("1");
  });

  it("explains an empty workspace instead of showing zeros", () => {
    renderHome({ projects: [], recentProjectIds: [], favoriteProjectIds: [], dockerStatus: undefined, workspaceRoot: "" });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("No repository in this workspace yet");
    expect(screen.getByText("No workspace scanned")).toBeVisible();
    expect(screen.getByText("Docker not detected")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Choose a folder" }).length).toBeGreaterThan(0);
  });

  // Many user-event steps against a full grid; under the parallel suite this needs more
  // than the default budget.
  it("customizes the layout: resize, keyboard reorder, hide, show again and reset", { timeout: 30_000 }, async () => {
    const user = userEvent.setup();
    let layout: DashboardLayout = DEFAULT_DASHBOARD_LAYOUT;
    const onLayoutChange = vi.fn((next: DashboardLayout) => {
      layout = next;
    });
    const { rerender, props } = renderHome({ onLayoutChange });
    const renderCurrent = () => rerender(<DashboardHome {...props} layout={layout} onLayoutChange={onLayoutChange} />);

    expect(screen.queryByRole("button", { name: "Hide Needs attention" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Customize" }));
    expect(screen.getByRole("button", { name: "Reset layout" })).toBeDisabled();

    const attentionFrame = document.querySelector('[data-widget-id="attention"]') as HTMLElement;
    await user.click(within(attentionFrame).getByRole("button", { name: "Large" }));
    expect(layout.widgets[0]).toEqual({ id: "attention", size: "large", hidden: false });
    renderCurrent();
    expect(screen.getByRole("status")).toHaveTextContent("Needs attention set to Large");

    await user.click(screen.getByRole("button", { name: "Move Needs attention later" }));
    expect(layout.widgets.map((widget) => widget.id).slice(0, 2)).toEqual(["workspace", "attention"]);
    renderCurrent();
    expect(screen.getByRole("status")).toHaveTextContent("Needs attention moved to position 2 of 7");
    expect(screen.getByRole("button", { name: "Move Workspace earlier" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Hide Shortcuts" }));
    renderCurrent();
    expect(screen.queryByRole("region", { name: "Shortcuts" })).not.toBeInTheDocument();
    const hiddenTray = screen.getByRole("region", { name: "Hidden widgets" });
    expect(within(hiddenTray).getByRole("button", { name: "Show Shortcuts" })).toBeVisible();

    await user.click(within(hiddenTray).getByRole("button", { name: "Show Favorites" }));
    renderCurrent();
    expect(screen.getByRole("region", { name: "Favorites" })).toBeVisible();
    expect(layout.widgets.filter((widget) => !widget.hidden).at(-1)?.id).toBe("favorites");

    await user.click(screen.getByRole("button", { name: "Reset layout" }));
    expect(layout).toBe(DEFAULT_DASHBOARD_LAYOUT);
    renderCurrent();
    expect(screen.getByRole("button", { name: "Reset layout" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("button", { name: /^Hide / })).not.toBeInTheDocument();
  });

  it("reorders with drag and drop while editing", async () => {
    const user = userEvent.setup();
    const onLayoutChange = vi.fn();
    renderHome({ onLayoutChange });
    await user.click(screen.getByRole("button", { name: "Customize" }));

    const grid = document.querySelector("[data-dashboard-grid]")!;
    const chats = grid.querySelector('[data-widget-id="chats"]')!;
    const attention = grid.querySelector('[data-widget-id="attention"]')!;
    vi.spyOn(attention, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 400, bottom: 200, width: 400, height: 200, toJSON: () => ({})
    });
    const dataTransfer = { setData: vi.fn(), effectAllowed: "", dropEffect: "" };
    // jsdom has no DragEvent; a MouseEvent carries the pointer position the drop logic reads.
    const dragEvent = (type: string, init: MouseEventInit = {}) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
      Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
      return event;
    };

    fireEvent(chats, dragEvent("dragstart"));
    fireEvent(attention, dragEvent("dragover", { clientX: 20, clientY: 100 }));
    fireEvent(attention, dragEvent("drop", { clientX: 20, clientY: 100 }));

    expect(onLayoutChange).toHaveBeenCalledTimes(1);
    const next = onLayoutChange.mock.calls[0][0] as DashboardLayout;
    expect(next.widgets.filter((widget) => !widget.hidden).map((widget) => widget.id).slice(0, 3)).toEqual(["chats", "attention", "workspace"]);
  });

  it("keeps the customize action unavailable while preferences cannot be saved", () => {
    renderHome({ canEditLayout: false });
    expect(screen.getByRole("button", { name: "Customize" })).toBeDisabled();
  });
});
