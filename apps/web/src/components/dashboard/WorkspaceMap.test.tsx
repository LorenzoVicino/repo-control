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
    await user.click(screen.getByRole("button", { name: "Rimuovi dirty dai preferiti" }));
    await user.click(screen.getByRole("button", { name: "Aggiungi behind ai preferiti" }));
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

    rerender(
      <FavoriteProjects
        projects={projects}
        favoriteProjectIds={[]}
        density="comfortable"
        onDensityChange={vi.fn()}
        {...callbacks}
      />
    );
    expect(screen.getByLabelText("Repository preferiti")).toBeVisible();
    expect(screen.getByText("Crea il tuo launchpad")).toBeVisible();

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
    const section = screen.getByLabelText("Repository preferiti");
    expect(section).toBeVisible();
    expect(screen.getByText("Aperto")).toBeVisible();
    expect(screen.getByRole("group", { name: "Densità repository preferiti" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Densità compatta" }));
    await user.click(screen.getByRole("button", { name: "Apri dirty" }));
    await user.click(screen.getByRole("button", { name: "Rimuovi dirty dai preferiti" }));
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

    expect(screen.getByRole("button", { name: /Da controllare/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Puliti e sincronizzati/ })).toBeVisible();
    expect(screen.getByText("Aperto")).toBeVisible();
  });
});
