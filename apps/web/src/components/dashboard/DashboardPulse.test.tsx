import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createProjectFixture } from "../../test/projectFixture";
import { renderWithTheme } from "../../test/render";
import { buildDashboardSnapshot } from "./dashboardSnapshot";
import { DashboardPulse } from "./DashboardPulse";

describe("DashboardPulse", () => {
  it("draws one arc per occupied signal and reports readiness in the ring", () => {
    const projects = [
      createProjectFixture("blocked", { isClean: false, staged: 2, modified: 3, untracked: 1, behind: 2 }),
      createProjectFixture("ahead", { ahead: 2 }),
      createProjectFixture("ready")
    ];
    const snapshot = buildDashboardSnapshot(projects, [], undefined);

    renderWithTheme(
      <DashboardPulse projects={projects} snapshot={snapshot} onOpenProject={vi.fn()} />
    );

    expect(screen.getByRole("heading", { name: "Workspace signals" })).toBeVisible();
    const distribution = screen.getByRole("img", { name: /1 blocked, 1 ahead, 1 in sync/i });
    expect(distribution).toBeVisible();

    // An empty signal contributes no arc, so the ring never carries a zero-width segment.
    expect(distribution.querySelector('[data-signal-key="blocked"]')).toBeInTheDocument();
    expect(distribution.querySelector('[data-signal-key="ahead"]')).toBeInTheDocument();
    expect(distribution.querySelector('[data-signal-key="ready"]')).toBeInTheDocument();
    expect(distribution.querySelector('[data-signal-key="action"]')).not.toBeInTheDocument();

    // Two of the three repositories are clean and not behind, which is what the figure in
    // the hole reports - the same definition the dashboard header uses.
    const readout = within(screen.getByTestId("signal-readout"));
    expect(readout.getByText("67%")).toBeVisible();
    expect(readout.getByText("2 of 3 repositories")).toBeVisible();
  });

  it("reads the pointed-at signal in the hole and dims the rest of the ring", async () => {
    const user = userEvent.setup();
    const projects = [
      createProjectFixture("blocked", { isClean: false, staged: 2, modified: 3, untracked: 1, behind: 2 }),
      createProjectFixture("stale-a", { behind: 1 }),
      createProjectFixture("stale-b", { behind: 1 }),
      createProjectFixture("ready")
    ];
    const snapshot = buildDashboardSnapshot(projects, [], undefined);

    renderWithTheme(
      <DashboardPulse projects={projects} snapshot={snapshot} onOpenProject={vi.fn()} />
    );

    const distribution = screen.getByRole("img", { name: /operational distribution/i });
    const actionArc = distribution.querySelector('[data-signal-key="action"]');
    const readout = () => within(screen.getByTestId("signal-readout"));
    expect(actionArc).toBeInTheDocument();
    expect(readout().getByText("25%")).toBeVisible();

    // Pointing at a state turns the hole into that state's readout.
    await user.hover(actionArc as Element);
    expect(readout().getByText("2")).toBeVisible();
    expect(readout().getByText("Needs action")).toBeVisible();
    expect(readout().queryByText("25%")).not.toBeInTheDocument();
    expect(actionArc).toHaveAttribute("data-active", "true");
    expect(distribution.querySelector('[data-signal-key="ready"]')).not.toHaveAttribute("data-active");

    await user.unhover(actionArc as Element);
    expect(readout().getByText("25%")).toBeVisible();

    // The legend drives the same state, so the ring answers from either side.
    await user.hover(screen.getByText("Blocked"));
    expect(distribution.querySelector('[data-signal-key="blocked"]')).toHaveAttribute("data-active", "true");

    // A state at zero has no arc, so its row must not dim the ring for nothing.
    await user.hover(screen.getByText("Ahead"));
    expect(readout().getByText("25%")).toBeVisible();
  });

  it("keeps the stacked change chart and opens a repository from it", async () => {
    const user = userEvent.setup();
    const onOpenProject = vi.fn();
    const projects = [
      createProjectFixture("blocked", { isClean: false, staged: 2, modified: 3, untracked: 1, behind: 2 }),
      createProjectFixture("ready")
    ];
    const snapshot = buildDashboardSnapshot(projects, [], undefined);

    renderWithTheme(
      <DashboardPulse projects={projects} snapshot={snapshot} onOpenProject={onOpenProject} />
    );

    const changeDistribution = screen.getByRole("img", { name: "2 staged, 3 modified, 1 new" });
    expect(changeDistribution).toBeVisible();

    for (const kind of ["staged", "modified", "untracked"]) {
      expect(changeDistribution.querySelector(`[data-change-kind="${kind}"]`)).toHaveAttribute(
        "data-animation",
        "continuous"
      );
    }

    const row = screen.getByRole("button", { name: "Open blocked, 6 changed files" });
    expect(within(row).getByText("6")).toBeVisible();
    await user.click(row);
    expect(onOpenProject).toHaveBeenCalledWith("blocked");
  });

  it("shows a useful empty state when the workspace has no repositories", () => {
    const snapshot = buildDashboardSnapshot([], [], undefined);

    renderWithTheme(
      <DashboardPulse projects={[]} snapshot={snapshot} onOpenProject={vi.fn()} />
    );

    expect(screen.getByText(/first workspace scan/i)).toBeVisible();
    expect(screen.getByText("Working trees aligned")).toBeVisible();
    expect(screen.queryByRole("img", { name: /operational distribution/i })).not.toBeInTheDocument();
  });
});
