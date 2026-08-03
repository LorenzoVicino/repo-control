import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../test/render";
import type { CommandResult } from "../../types/common";
import type { GitDetails, GitFileChange, GitFileStatus } from "../../types/git";
import { ChangesPanel } from "./ChangesPanel";

const runProjectAction = vi.fn();

vi.mock("../../api/projects", () => ({
  runProjectAction: (...args: unknown[]) => runProjectAction(...args)
}));

vi.mock("../shared/ActionButton", () => ({
  ActionButton: ({ label, disabled }: { label: string; disabled?: boolean }) => (
    <button type="button" disabled={disabled}>{label}</button>
  )
}));

function file(path: string, status: GitFileStatus, overrides: Partial<GitFileChange> = {}): GitFileChange {
  return { path, previousPath: null, status, label: status, ...overrides };
}

function details(overrides: Partial<GitDetails["status"]> = {}): GitDetails {
  return {
    status: {
      current: "main",
      detached: false,
      isClean: false,
      tracking: "origin/main",
      ahead: 2,
      behind: 1,
      files: {
        staged: [file("src/staged.ts", "staged")],
        unstaged: [
          file("src/modified.ts", "modified"),
          file("src/deleted.ts", "deleted"),
          file("src/conflict.ts", "conflicted"),
          file("src/new-name.ts", "renamed", { previousPath: "src/old-name.ts" }),
          file("src/untracked.ts", "untracked")
        ]
      },
      ...overrides
    },
    branches: { current: "main", local: [], remote: [] },
    stashes: [
      { ref: "stash@{0}", index: 0, date: "2026-08-03T10:00:00.000Z", message: "coverage work" },
      { ref: "stash@{1}", index: 1, date: "", message: "without date" }
    ]
  };
}

function result(overrides: Partial<CommandResult> = {}): CommandResult {
  return { ok: true, command: "git", exitCode: 0, stdout: "", stderr: "", output: "ok", durationMs: 5, ...overrides };
}

function renderPanel(gitDetails: GitDetails | null = details(), isLoading = false) {
  const callbacks = { onResult: vi.fn(), onCompleted: vi.fn() };
  const view = renderWithTheme(
    <ChangesPanel projectId="alpha" details={gitDetails ?? undefined} isLoading={isLoading} {...callbacks} />
  );
  return { ...view, ...callbacks };
}

describe("ChangesPanel", () => {
  beforeEach(() => runProjectAction.mockReset());

  it("renders loading and unavailable Git states", () => {
    const loading = renderPanel(null, true);
    expect(screen.getByText("Caricamento Git")).toBeVisible();
    loading.unmount();
    renderPanel(null);
    expect(screen.getByText("Git non disponibile")).toBeVisible();
  });

  it("renders a clean repository with empty sections and disabled actions", () => {
    const cleanDetails = details({
      isClean: true,
      tracking: null,
      ahead: 0,
      behind: 0,
      files: { staged: [], unstaged: [] }
    });
    cleanDetails.stashes = [];
    renderPanel(cleanDetails);

    expect(screen.getByText("working tree pulito")).toBeVisible();
    expect(screen.getByText("Nessun file staged")).toBeVisible();
    expect(screen.getByText("Nessun file unstaged")).toBeVisible();
    expect(screen.getByText("Nessuno stash")).toBeVisible();
    for (const name of ["Unstage all", "Stage all", "Pull", "Push", "Stash changes", "Commit"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(screen.getByText("0 ahead")).toBeVisible();
    expect(screen.getByText("0 behind")).toBeVisible();
  });

  it("shows every file status, renamed paths, sync data and stash variants", () => {
    renderPanel();

    expect(screen.getByText("6 modifiche")).toBeVisible();
    expect(screen.getByText("1 staged")).toBeVisible();
    expect(screen.getByText("5 unstaged")).toBeVisible();
    expect(screen.getByText("origin/main")).toBeVisible();
    expect(screen.getByText("src/old-name.ts -> src/new-name.ts")).toBeVisible();
    for (const status of ["staged", "modified", "deleted", "conflicted", "renamed", "untracked"]) {
      expect(screen.getByText(status)).toBeVisible();
    }
    expect(screen.getByText("coverage work")).toBeVisible();
    expect(screen.getByText("without date")).toBeVisible();
    expect(screen.getByRole("button", { name: "Pop stash@{0}" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Pop stash@{1}" })).toBeEnabled();
    for (const name of ["Unstage all", "Stage all", "Pull", "Push", "Stash changes"]) {
      expect(screen.getByRole("button", { name })).toBeEnabled();
    }
  });

  it("commits a trimmed message with Ctrl+Enter and clears it on success", async () => {
    const resultValue = result({ command: "git commit" });
    runProjectAction.mockResolvedValue(resultValue);
    const { onResult, onCompleted } = renderPanel();
    const input = screen.getByRole("textbox", { name: "Messaggio commit" });

    fireEvent.change(input, { target: { value: "  cover risky flow  " } });
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(runProjectAction).toHaveBeenCalledWith(
      "alpha", "git/commit", "Commit", { message: "cover risky flow" }
    ));
    expect(onResult).toHaveBeenCalledWith(resultValue);
    expect(onCompleted).toHaveBeenCalledOnce();
    expect(input).toHaveValue("");
  });

  it("keeps the message after a failed result and ignores unrelated keys", async () => {
    const user = userEvent.setup();
    runProjectAction.mockResolvedValue(result({ ok: false, exitCode: 1 }));
    const { onCompleted } = renderPanel();
    const input = screen.getByRole("textbox", { name: "Messaggio commit" });
    await user.type(input, "message");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(runProjectAction).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Commit" }));
    await waitFor(() => expect(onCompleted).toHaveBeenCalledOnce());
    expect(input).toHaveValue("message");
  });

  it("reports commit exceptions and re-enables the action", async () => {
    const user = userEvent.setup();
    runProjectAction.mockRejectedValueOnce(new Error("commit failed")).mockRejectedValueOnce("unknown");
    const { onResult, onCompleted } = renderPanel();
    const input = screen.getByRole("textbox", { name: "Messaggio commit" });

    await user.type(input, "first");
    await user.click(screen.getByRole("button", { name: "Commit" }));
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({ output: "commit failed" })));
    expect(screen.getByRole("button", { name: "Commit" })).toBeEnabled();
    fireEvent.change(input, { target: { value: "second" } });
    await user.click(screen.getByRole("button", { name: "Commit" }));
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({ output: "Command failed" })));
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it("runs file actions with original paths and handles their failures", async () => {
    const user = userEvent.setup();
    runProjectAction.mockResolvedValueOnce(result()).mockRejectedValueOnce(new Error("stage failed"));
    const { onResult, onCompleted } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Unstage file" }));
    await waitFor(() => expect(runProjectAction).toHaveBeenLastCalledWith(
      "alpha", "git/unstage", "Unstage file", { path: "src/staged.ts", previousPath: null }
    ));
    expect(onCompleted).toHaveBeenCalledOnce();

    const stageButtons = screen.getAllByRole("button", { name: "Stage file" });
    await user.click(stageButtons[3]!);
    await waitFor(() => expect(runProjectAction).toHaveBeenLastCalledWith(
      "alpha", "git/stage", "Stage file", { path: "src/new-name.ts", previousPath: "src/old-name.ts" }
    ));
    expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({ output: "stage failed" }));
    expect(onCompleted).toHaveBeenCalledOnce();
    expect(stageButtons[3]).toBeEnabled();
  });

  it("shows pending file and stash actions and prevents duplicate clicks", async () => {
    let resolveFile!: (value: CommandResult) => void;
    let resolveStash!: (value: CommandResult) => void;
    runProjectAction
      .mockImplementationOnce(() => new Promise<CommandResult>((resolve) => { resolveFile = resolve; }))
      .mockImplementationOnce(() => new Promise<CommandResult>((resolve) => { resolveStash = resolve; }));
    renderPanel();

    const fileButton = screen.getByRole("button", { name: "Unstage file" });
    fireEvent.click(fileButton);
    expect(fileButton).toBeDisabled();
    fireEvent.click(fileButton);
    expect(runProjectAction).toHaveBeenCalledOnce();
    resolveFile(result());
    await waitFor(() => expect(fileButton).toBeEnabled());

    const stashButton = screen.getByRole("button", { name: "Pop stash@{0}" });
    fireEvent.click(stashButton);
    expect(stashButton).toBeDisabled();
    await waitFor(() => expect(runProjectAction).toHaveBeenCalledTimes(2));
    resolveStash(result());
    await waitFor(() => expect(stashButton).toBeEnabled());
  });

  it("pops stashes and reports both typed and unknown failures", async () => {
    const user = userEvent.setup();
    runProjectAction
      .mockResolvedValueOnce(result())
      .mockRejectedValueOnce(new Error("pop failed"))
      .mockRejectedValueOnce("unknown");
    const { onResult, onCompleted } = renderPanel();

    await user.click(screen.getByRole("button", { name: "Pop stash@{0}" }));
    await waitFor(() => expect(runProjectAction).toHaveBeenLastCalledWith(
      "alpha", "git/stash-pop", "Pop stash@{0}", { ref: "stash@{0}" }
    ));
    expect(onCompleted).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Pop stash@{1}" }));
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({ output: "pop failed" })));
    await user.click(screen.getByRole("button", { name: "Pop stash@{1}" }));
    await waitFor(() => expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({ output: "Command failed" })));
  });

  it("virtualizes long file lists and cancels pending animation work on unmount", () => {
    const frameCallbacks: FrameRequestCallback[] = [];
    const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return 42;
    });
    const cancelFrame = vi.spyOn(window, "cancelAnimationFrame");
    const longDetails = details({
      files: {
        staged: [],
        unstaged: Array.from({ length: 30 }, (_, index) => file(`src/file-${index}.ts`, "modified"))
      }
    });
    const view = renderPanel(longDetails);
    expect(screen.getByText("src/file-0.ts")).toBeVisible();
    expect(screen.queryByText("src/file-20.ts")).not.toBeInTheDocument();

    const scrollContainer = screen.getByText("src/file-0.ts").parentElement?.parentElement?.parentElement?.parentElement;
    expect(scrollContainer).toBeTruthy();
    fireEvent.scroll(scrollContainer!, { target: { scrollTop: 820 } });
    fireEvent.scroll(scrollContainer!, { target: { scrollTop: 900 } });
    expect(requestFrame).toHaveBeenCalledOnce();
    view.unmount();
    expect(cancelFrame).toHaveBeenCalledWith(42);

    frameCallbacks[0]?.(0);
  });
});
