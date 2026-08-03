import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../test/render";
import type { CommandResult } from "../../types/common";
import type { GitBranchInfo, GitDetails } from "../../types/git";
import { BranchesPanel } from "./BranchesPanel";

const runProjectAction = vi.fn();

vi.mock("../../api/projects", () => ({
  runProjectAction: (...args: unknown[]) => runProjectAction(...args)
}));

vi.mock("../shared/ActionButton", () => ({
  ActionButton: ({ label, disabled }: { label: string; disabled?: boolean }) => (
    <button type="button" disabled={disabled}>{label}</button>
  )
}));

function branch(name: string, overrides: Partial<GitBranchInfo> = {}): GitBranchInfo {
  return { name, current: false, remote: false, upstream: null, ahead: 0, behind: 0, ...overrides };
}

function details(overrides: Partial<GitDetails["status"]> = {}, local?: GitBranchInfo[], remote?: GitBranchInfo[]): GitDetails {
  return {
    status: {
      current: "main",
      detached: false,
      isClean: true,
      tracking: "origin/main",
      ahead: 2,
      behind: 1,
      files: { staged: [], unstaged: [] },
      ...overrides
    },
    branches: {
      current: "main",
      local: local ?? [branch("main", { current: true, upstream: "origin/main" }), branch("feature", { ahead: 1 })],
      remote: remote ?? [branch("origin/main", { remote: true, behind: 1 })]
    },
    stashes: []
  };
}

function result(overrides: Partial<CommandResult> = {}): CommandResult {
  return { ok: true, command: "git", exitCode: 0, stdout: "", stderr: "", output: "ok", durationMs: 4, ...overrides };
}

function renderPanel(gitDetails: GitDetails | null = details(), isLoading = false) {
  const callbacks = { onResult: vi.fn(), onCompleted: vi.fn() };
  const view = renderWithTheme(
    <BranchesPanel projectId="alpha" details={gitDetails ?? undefined} isLoading={isLoading} {...callbacks} />
  );
  return { ...view, ...callbacks };
}

describe("BranchesPanel", () => {
  beforeEach(() => runProjectAction.mockReset());

  it("renders loading and unavailable states", () => {
    const loading = renderPanel(null, true);
    expect(screen.getByText("Caricamento branches")).toBeVisible();
    loading.unmount();
    renderPanel(null);
    expect(screen.getByText("Branches non disponibili")).toBeVisible();
  });

  it("shows repository and branch metadata including empty groups", () => {
    renderPanel(details({}, [branch("main", { current: true, upstream: "origin/main", ahead: 3, behind: 2 })], []));
    expect(screen.getAllByText("main")).toHaveLength(2);
    expect(screen.getAllByText("origin/main")).toHaveLength(2);
    expect(screen.getByText("ahead 2")).toBeVisible();
    expect(screen.getByText("behind 1")).toBeVisible();
    expect(screen.getByText("ahead 3")).toBeVisible();
    expect(screen.getByText("behind 2")).toBeVisible();
    expect(screen.getByText("current")).toBeVisible();
    expect(screen.getByText("Nessun branch")).toBeVisible();
    expect(screen.getByRole("button", { name: "Checkout" })).toBeDisabled();
  });

  it("creates a trimmed branch and clears its field after success", async () => {
    const user = userEvent.setup();
    runProjectAction.mockResolvedValue(result());
    const { onResult, onCompleted } = renderPanel();
    const input = screen.getByRole("textbox", { name: "Nuovo branch" });
    await user.type(input, "  feature/coverage  ");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(runProjectAction).toHaveBeenCalledWith(
      "alpha", "git/branch", "Create branch feature/coverage", { branch: "feature/coverage" }
    ));
    expect(input).toHaveValue("");
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it("keeps a branch name after a failed command result", async () => {
    const user = userEvent.setup();
    runProjectAction.mockResolvedValue(result({ ok: false, exitCode: 1 }));
    const { onCompleted } = renderPanel();
    const input = screen.getByRole("textbox", { name: "Nuovo branch" });
    await user.type(input, "broken");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(onCompleted).toHaveBeenCalledOnce());
    expect(input).toHaveValue("broken");
  });

  it("checks out local and remote branches with the correct payload", async () => {
    const user = userEvent.setup();
    runProjectAction.mockResolvedValue(result());
    renderPanel();
    const groups = screen.getAllByText(/branches$/).map((title) => title.closest("div.MuiBox-root") as HTMLElement);
    const localCheckout = within(groups[0]!).getAllByRole("button", { name: "Checkout" })[1]!;
    const remoteCheckout = within(groups[1]!).getByRole("button", { name: "Checkout" });

    await user.click(localCheckout);
    await waitFor(() => expect(runProjectAction).toHaveBeenLastCalledWith(
      "alpha", "git/checkout", "Checkout feature", { branch: "feature", remote: false }
    ));
    await user.click(remoteCheckout);
    await waitFor(() => expect(runProjectAction).toHaveBeenLastCalledWith(
      "alpha", "git/checkout", "Checkout origin/main", { branch: "origin/main", remote: true }
    ));
  });

  it("reports thrown branch errors and restores the controls", async () => {
    const user = userEvent.setup();
    runProjectAction.mockRejectedValueOnce(new Error("checkout failed")).mockRejectedValueOnce("bad");
    const { onResult, onCompleted } = renderPanel();
    const checkout = screen.getAllByRole("button", { name: "Checkout" })[1]!;
    await user.click(checkout);
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({ output: "checkout failed" })));
    expect(onCompleted).not.toHaveBeenCalled();
    expect(checkout).toBeEnabled();

    const input = screen.getByRole("textbox", { name: "Nuovo branch" });
    fireEvent.change(input, { target: { value: "error" } });
    await user.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({ output: "Command failed" })));
  });

  it("blocks checkout and branch creation on dirty repositories", () => {
    renderPanel(details({ isClean: false, tracking: null, ahead: 0, behind: 0 }));
    expect(screen.getByText("checkout bloccato: dirty")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Nuovo branch" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: "Checkout" }).every((button) => button.hasAttribute("disabled"))).toBe(true);
    expect(screen.getByRole("button", { name: "Pull ff-only" })).toBeDisabled();
  });

  it("reveals hidden branches in batches", async () => {
    const user = userEvent.setup();
    const branches = Array.from({ length: 38 }, (_, index) => branch(`feature-${index}`));
    renderPanel(details({}, branches, []));
    expect(screen.queryByText("feature-12")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mostra altri 24" }));
    expect(screen.getByText("feature-35")).toBeVisible();
    expect(screen.getByRole("button", { name: "Mostra altri 2" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Mostra altri 2" }));
    expect(screen.getByText("feature-37")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Mostra altri/ })).not.toBeInTheDocument();
  });
});
