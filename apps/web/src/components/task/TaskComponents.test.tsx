import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createProjectFixture } from "../../test/projectFixture";
import { renderWithTheme } from "../../test/render";
import type { BrainTask, TaskPlanDraft } from "../../types/brain";
import { TaskList } from "./TaskList";
import { TaskPlanReview } from "./TaskPlanReview";
import {
  formatTaskDate,
  getContextProjectIds,
  getTaskErrorMessage,
  haveSameProjectIds
} from "./taskEngineeringUtils";

const draft: TaskPlanDraft = {
  provider: "claude",
  providerLabel: "Claude Code",
  sessionId: null,
  generatedAt: "2026-08-03T00:00:00.000Z",
  title: "Coverage",
  type: "feature",
  profile: "full",
  description: "Raise coverage",
  motivation: "Prevent regressions",
  requirements: "Reach 80%",
  design: "Test boundaries",
  breakdown: "Add tests",
  checks: ["npm test"],
  assumptions: ["CI available"],
  questions: [{ id: "database", question: "Database?", options: ["Postgres", "SQLite"], recommendedOption: "Postgres" }]
};

function brainTask(overrides: Partial<BrainTask> = {}): BrainTask {
  return {
    id: "task-1",
    title: "Coverage",
    type: "feature",
    status: "implementation",
    contextRepositoryPaths: [],
    definition: { description: "Description", motivation: "Motivation" },
    requirements: { content: "Requirements", approvedAt: null },
    design: { content: "Design", approvedAt: null },
    breakdown: { content: "Breakdown", approvedAt: null },
    verificationChecks: ["npm test"],
    planning: { profile: "full", provider: "claude", brief: "Brief", generatedAt: null, assumptions: [] },
    implementation: { log: [], runs: [] },
    decisions: [],
    git: { branch: null, prUrl: null },
    claudeSessionId: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    ...overrides
  };
}

describe("task supporting components", () => {
  it("edits and approves a fully answered plan", async () => {
    const user = userEvent.setup();
    const callbacks = {
      onDraftChange: vi.fn(),
      onAnswerChange: vi.fn(),
      onFeedbackChange: vi.fn(),
      onRefine: vi.fn(),
      onApprove: vi.fn(),
      onBack: vi.fn()
    };
    renderWithTheme(
      <TaskPlanReview
        draft={draft}
        answers={{ database: "Postgres" }}
        feedback="Add rollback"
        busy={false}
        planning={false}
        creating={false}
        error="Review warning"
        {...callbacks}
      />
    );

    expect(screen.getByText("Review warning")).toBeVisible();
    await user.click(screen.getByRole("radio", { name: "SQLite" }));
    expect(callbacks.onAnswerChange).toHaveBeenCalledWith("database", "SQLite");
    fireEvent.change(screen.getByRole("textbox", { name: "Titolo" }), { target: { value: "Coverage 80" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Problema e risultato desiderato" }), { target: { value: "New description" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Motivazione" }), { target: { value: "New motivation" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Requisiti e criteri di accettazione" }), { target: { value: "New requirements" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Approccio tecnico" }), { target: { value: "New design" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Passi di implementazione" }), { target: { value: "New steps" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Comandi di verifica" }), { target: { value: " npm test \n\n npm run build " } });
    fireEvent.mouseDown(screen.getAllByRole("combobox")[0]!);
    await user.click(screen.getByRole("option", { name: "Fix" }));
    fireEvent.mouseDown(screen.getAllByRole("combobox")[1]!);
    await user.click(screen.getByRole("option", { name: "Rapido" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Feedback per Claude" }), { target: { value: "More tests" } });
    await user.click(screen.getByRole("button", { name: "Aggiorna con Claude" }));
    await user.click(screen.getByRole("button", { name: "Torna al brief" }));
    await user.click(screen.getByRole("button", { name: "Approva piano e prepara l’implementazione" }));

    expect(callbacks.onDraftChange).toHaveBeenCalledWith(expect.objectContaining({ checks: ["npm test", "npm run build"] }));
    expect(callbacks.onFeedbackChange).toHaveBeenCalledWith("More tests");
    expect(callbacks.onRefine).toHaveBeenCalled();
    expect(callbacks.onBack).toHaveBeenCalled();
    expect(callbacks.onApprove).toHaveBeenCalled();
  }, 20_000);

  it("explains complete plans and disables invalid or busy actions", () => {
    const callbacks = {
      onDraftChange: vi.fn(),
      onAnswerChange: vi.fn(),
      onFeedbackChange: vi.fn(),
      onRefine: vi.fn(),
      onApprove: vi.fn(),
      onBack: vi.fn()
    };
    renderWithTheme(
      <TaskPlanReview
        draft={{ ...draft, title: "", checks: [], assumptions: [], questions: [] }}
        answers={{}}
        feedback=""
        busy
        planning
        creating
        error={null}
        {...callbacks}
      />
    );
    expect(screen.getByText(/non servono altri chiarimenti/)).toBeVisible();
    expect(screen.getByText("Nessuna assunzione rilevante dichiarata.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Aggiorna con Claude" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Interrompi e torna al brief" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Creazione task" })).toBeDisabled();
  });

  it("renders loading, empty and selectable task lists", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const loading = renderWithTheme(<TaskList tasks={[]} selectedTaskId={null} loading onSelect={onSelect} />);
    expect(screen.getByRole("progressbar")).toBeVisible();
    loading.unmount();

    const empty = renderWithTheme(<TaskList tasks={[]} selectedTaskId={null} loading={false} onSelect={onSelect} />);
    expect(screen.getByText("Nessun task per questo repository.")).toBeVisible();
    empty.unmount();

    renderWithTheme(
      <TaskList
        tasks={[
          brainTask(),
          brainTask({ id: "task-2", title: "Manual task", status: "done", planning: { ...brainTask().planning, provider: "manual" } })
        ]}
        selectedTaskId="task-1"
        loading={false}
        onSelect={onSelect}
      />
    );
    await user.click(screen.getByText("Manual task"));
    expect(onSelect).toHaveBeenCalledWith("task-2");
    expect(screen.getByText("Completato")).toBeVisible();
  });

  it("normalizes context IDs, comparisons, dates and unknown errors", () => {
    const projects = [
      createProjectFixture("alpha", { path: "/workspace/alpha" }),
      createProjectFixture("beta", { path: "/workspace/beta" })
    ];
    expect(getContextProjectIds(projects, ["/workspace/beta", "/missing"])).toEqual(["beta"]);
    expect(haveSameProjectIds(["beta", "alpha"], ["alpha", "beta"])).toBe(true);
    expect(haveSameProjectIds(["alpha"], ["alpha", "beta"])).toBe(false);
    expect(haveSameProjectIds(["alpha"], ["beta"])).toBe(false);
    expect(formatTaskDate("2026-08-03T09:00:00.000Z")).toMatch(/2026/);
    expect(getTaskErrorMessage(new Error("specific"))).toBe("specific");
    expect(getTaskErrorMessage("unknown")).toBe("Operazione non riuscita");
  });
});
