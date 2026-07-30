import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../test/render";
import type { WorkflowRun } from "../../types/workflows";
import { AutomationRunDialog } from "./AutomationRunDialog";

function createRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: "run-1",
    workflowId: "workflow-1",
    workflowName: "Release workflow",
    mode: "run",
    status: "running",
    startedAt: new Date().toISOString(),
    completedAt: "",
    durationMs: 0,
    steps: [],
    summary: { selectedProjects: 1, succeeded: 0, failed: 0, skipped: 0, commands: 1 },
    statusMessage: null,
    ...overrides
  };
}

describe("AutomationRunDialog", () => {
  it("shows an enabled cancel action for an active run and calls onCancel", () => {
    const onCancel = vi.fn();

    renderWithTheme(
      <AutomationRunDialog run={createRun()} onClose={vi.fn()} onCancel={onCancel} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Annulla esecuzione" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("is always closable, even while the run is active", () => {
    const onClose = vi.fn();

    renderWithTheme(
      <AutomationRunDialog run={createRun()} onClose={onClose} onCancel={vi.fn()} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Chiudi" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("hides the cancel action and surfaces the status message for a cancelled run", () => {
    renderWithTheme(
      <AutomationRunDialog
        run={createRun({
          status: "cancelled",
          completedAt: new Date().toISOString(),
          statusMessage: "Cancelled by user"
        })}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByRole("button", { name: "Annullando esecuzione" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Annulla esecuzione" })).not.toBeInTheDocument();
    expect(screen.getByText("Cancelled by user")).toBeVisible();
  });
});
