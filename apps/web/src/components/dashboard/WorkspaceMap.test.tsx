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

    expect(screen.getByText("Modifiche locali")).toBeVisible();
    expect(screen.getByText("Aggiornamento remoto disponibile")).toBeVisible();
    expect(screen.getByText("Commit locali da pubblicare")).toBeVisible();
    expect(screen.getByText("Sincronizzato e pulito")).toBeVisible();
    expect(screen.getByText("Dirty commit")).toBeVisible();
    expect(screen.getAllByText("Nessun commit")).toHaveLength(3);
    expect(screen.getByText("+3 ahead")).toBeVisible();
    expect(screen.getByText("2 behind")).toBeVisible();
    expect(screen.getByText("3 modifiche")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Apri dirty" }));
    await user.click(screen.getByRole("button", { name: "Rimuovi dai preferiti" }));
    await user.click(screen.getAllByRole("button", { name: "Aggiungi ai preferiti" })[0]!);
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
    expect(screen.getByText("Nessun repository trovato")).toBeVisible();

    rerender(<FavoriteProjects projects={projects} favoriteProjectIds={[]} {...callbacks} />);
    expect(screen.queryByLabelText("Repository preferiti")).not.toBeInTheDocument();

    rerender(<FavoriteProjects projects={projects} favoriteProjectIds={["dirty"]} {...callbacks} />);
    const section = screen.getByLabelText("Repository preferiti");
    expect(section).toBeVisible();
    const toggle = screen.getByRole("button", { name: /Preferiti/ });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Apri dirty" }));
    expect(callbacks.onSelectProject).toHaveBeenCalledWith("dirty");
  });
});
