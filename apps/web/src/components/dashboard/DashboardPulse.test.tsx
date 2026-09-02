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
    expect(screen.getByText("67%")).toBeVisible();
    expect(screen.getByText("2 of 3 repositories")).toBeVisible();
  });

  it("groups the three file states on one scale and opens a repository", async () => {
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

    // Every state keeps its own bar, including the ones at zero, so the rows stay aligned
    // and "nothing staged here" is readable rather than absent.
    for (const kind of ["staged", "modified", "untracked"]) {
      expect(changeDistribution.querySelector(`[data-change-kind="${kind}"]`)).toBeInTheDocument();
    }

    // The shared scale is the largest single state, not the largest repository total.
    expect(screen.getByText("scale 0–3 files")).toBeVisible();

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
