import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../test/render";
import type { ProjectSummary } from "../../types/projects";
import { RepositoryCommandPalette } from "./RepositoryCommandPalette";

const projects: ProjectSummary[] = [
  createProject("alpha", "Alpha API", true),
  createProject("beta", "Beta Web", false)
];

describe("RepositoryCommandPalette", () => {
  it("focuses search and opens the keyboard-selected repository", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onOpenProject = vi.fn();

    renderWithTheme(
      <PaletteHarness onClose={onClose} onOpenProject={onOpenProject} />
    );

    const searchInput = screen.getByPlaceholderText("Cerca repository (Ctrl+P)");
    await waitFor(() => expect(searchInput).toHaveFocus());

    await user.keyboard("{ArrowDown}{Enter}");

    expect(onOpenProject).toHaveBeenCalledWith("beta");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("filters repositories and exposes a clear empty state", async () => {
    const user = userEvent.setup();

    renderWithTheme(
      <PaletteHarness onClose={vi.fn()} onOpenProject={vi.fn()} />
    );

    const searchInput = screen.getByPlaceholderText("Cerca repository (Ctrl+P)");
    await user.clear(searchInput);
    await user.type(searchInput, "missing repository");

    expect(screen.getByText("Nessun repository trovato")).toBeVisible();
    expect(screen.queryByText("Alpha API")).not.toBeInTheDocument();
  });
});

type PaletteHarnessProps = {
  onClose: () => void;
  onOpenProject: (projectId: string) => void;
};

function PaletteHarness({ onClose, onOpenProject }: PaletteHarnessProps) {
  const [query, setQuery] = React.useState("");

  return (
    <RepositoryCommandPalette
      open
      projects={projects}
      query={query}
      onQueryChange={setQuery}
      onClose={onClose}
      onOpenProject={onOpenProject}
    />
  );
}

function createProject(id: string, name: string, isClean: boolean): ProjectSummary {
  return {
    id,
    name,
    path: `/workspace/${id}`,
    branch: "main",
    isClean,
    staged: 0,
    modified: isClean ? 0 : 1,
    untracked: 0,
    ahead: 0,
    behind: 0,
    upstream: "origin/main",
    lastCommit: null,
    hasDockerCompose: false
  };
}
