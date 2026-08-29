import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createProjectFixture } from "../../test/projectFixture";
import { renderWithTheme } from "../../test/render";
import { FavoriteProjects, WorkspaceMap } from "./WorkspaceMap";

const projects = [
  createProjectFixture("dirty", {
    path: "/workspace/team/dirty",
    isClean: false,
    modified: 1,
    staged: 1,
    untracked: 1,
    lastCommit: { hash: "abc", message: "Dirty commit", date: "2026-08-01T00:00:00.000Z", author: "Ada" }
  }),
  createProjectFixture("behind", { path: "/workspace/team/behind", behind: 2 }),
  createProjectFixture("ahead", { path: "/workspace/solo", ahead: 3 }),
  createProjectFixture("clean", { path: "/workspace/clean" })
];

describe("WorkspaceMap", () => {
  it("groups repositories and exposes all status and interaction branches", async () => {
    const user = userEvent.setup();
    const onSelectProject = vi.fn();
    const onToggleFavorite = vi.fn();
    renderWithTheme(
      <WorkspaceMap
        root="/workspace"
        projects={projects}
        favoriteProjectIds={["dirty"]}
        onSelectProject={onSelectProject}
        onToggleFavorite={onToggleFavorite}
      />
    );

    expect(screen.getByText("Local changes")).toBeVisible();
    expect(screen.getByText("Remote update available")).toBeVisible();
    expect(screen.getByText("Local commits to publish")).toBeVisible();
    expect(screen.getByText("Synchronized and clean")).toBeVisible();
    expect(screen.getByText("Dirty commit")).toBeVisible();
    expect(screen.getAllByText("No commit")).toHaveLength(3);
    expect(screen.getByText("+3 ahead")).toBeVisible();
    expect(screen.getByText("2 behind")).toBeVisible();
    expect(screen.getByText("3 changes")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Apri dirty" }));
    await user.click(screen.getByRole("button", { name: "Remove dirty from favorites" }));
    await user.click(screen.getByRole("button", { name: "Add behind to favorites" }));
    expect(onSelectProject).toHaveBeenCalledWith("dirty");
    expect(onToggleFavorite).toHaveBeenCalledTimes(2);

    const teamToggle = screen.getByRole("button", { name: /team/i });
    await user.click(teamToggle);
    expect(teamToggle).toHaveAttribute("aria-expanded", "false");
    await user.click(teamToggle);
    expect(teamToggle).toHaveAttribute("aria-expanded", "true");
  }, 20_000);

  it("renders empty workspace and favorite states", async () => {
    const user = userEvent.setup();
    const callbacks = { onSelectProject: vi.fn(), onToggleFavorite: vi.fn() };
    const { rerender } = renderWithTheme(
      <WorkspaceMap root="/workspace" projects={[]} favoriteProjectIds={[]} {...callbacks} />
    );
    expect(screen.getByText("No repository found")).toBeVisible();

    rerender(
      <FavoriteProjects
        projects={projects}
        favoriteProjectIds={[]}
        density="comfortable"
        onDensityChange={vi.fn()}
        {...callbacks}
      />
    );
    expect(screen.getByLabelText("Favorite repositories")).toBeVisible();
    expect(screen.getByText("Build your launchpad")).toBeVisible();

    const onDensityChange = vi.fn();
    rerender(
      <FavoriteProjects
        projects={projects}
        favoriteProjectIds={["dirty"]}
        openProjectIds={["dirty"]}
        density="comfortable"
        onDensityChange={onDensityChange}
        {...callbacks}
      />
    );
    const section = screen.getByLabelText("Favorite repositories");
    expect(section).toBeVisible();
    expect(screen.getByText("Open")).toBeVisible();
    expect(screen.getByRole("group", { name: "Favorite repository density" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Compact density" }));
    await user.click(screen.getByRole("button", { name: "Apri dirty" }));
    await user.click(screen.getByRole("button", { name: "Remove dirty from favorites" }));
    expect(onDensityChange).toHaveBeenCalledWith("compact");
    expect(callbacks.onSelectProject).toHaveBeenCalledWith("dirty");
    expect(callbacks.onToggleFavorite).toHaveBeenCalledWith("dirty");
  });

  it("groups by operating status and marks already-open repositories", () => {
    renderWithTheme(
      <WorkspaceMap
        root="/workspace"
        projects={projects}
        favoriteProjectIds={[]}
        openProjectIds={["clean"]}
        density="compact"
        groupBy="status"
        onSelectProject={vi.fn()}
        onToggleFavorite={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /Needs attention/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Clean and synchronized/ })).toBeVisible();
    expect(screen.getByText("Open")).toBeVisible();
  });
});
