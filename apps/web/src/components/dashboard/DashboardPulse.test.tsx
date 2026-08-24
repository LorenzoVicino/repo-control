import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createProjectFixture } from "../../test/projectFixture";
import { renderWithTheme } from "../../test/render";
import { buildDashboardSnapshot } from "./dashboardSnapshot";
import { DashboardPulse } from "./DashboardPulse";

describe("DashboardPulse", () => {
  it("renders an accessible operational distribution and opens a repository from the change chart", async () => {
    const user = userEvent.setup();
    const onOpenProject = vi.fn();
    const projects = [
      createProjectFixture("blocked", { isClean: false, modified: 3, untracked: 1, behind: 2 }),
      createProjectFixture("ahead", { ahead: 2 }),
      createProjectFixture("ready")
    ];
    const snapshot = buildDashboardSnapshot(projects, [], undefined);

    renderWithTheme(
      <DashboardPulse projects={projects} snapshot={snapshot} onOpenProject={onOpenProject} />
    );

    expect(screen.getByRole("heading", { name: "Segnali workspace" })).toBeVisible();
    const distribution = screen.getByRole("img", { name: /1 bloccati, 1 ahead, 1 pronti/i });
    expect(distribution).toBeVisible();
    expect(distribution.querySelector('[data-signal-key="blocked"]')).toHaveAttribute("data-animation", "continuous");
    expect(distribution.querySelector('[data-signal-key="ready"]')).toHaveAttribute("data-animation", "continuous");
    expect(distribution.querySelector('[data-signal-key="ahead"]')).toHaveAttribute("data-animation", "static");
    expect(screen.getByRole("img", { name: "0 staged, 3 modificati, 1 nuovi" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Apri blocked, 4 file modificati" }));
    expect(onOpenProject).toHaveBeenCalledWith("blocked");
  });

  it("shows a useful empty state when the workspace has no repositories", () => {
    const snapshot = buildDashboardSnapshot([], [], undefined);

    renderWithTheme(
      <DashboardPulse projects={[]} snapshot={snapshot} onOpenProject={vi.fn()} />
    );

    expect(screen.getByText(/prima scansione del workspace/i)).toBeVisible();
    expect(screen.getByText("Working tree allineati")).toBeVisible();
  });
});
