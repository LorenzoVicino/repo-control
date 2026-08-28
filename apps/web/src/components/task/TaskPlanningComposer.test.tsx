import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelBrainTaskPlanning,
  createBrainTaskFromPlan,
  planBrainTask
} from "../../api/brain";
import { createProjectFixture } from "../../test/projectFixture";
import { renderWithTheme } from "../../test/render";
import type { BrainTask, TaskPlanDraft } from "../../types/brain";
import { TaskPlanningComposer } from "./TaskPlanningComposer";

vi.mock("../../api/brain", () => ({
  cancelBrainTaskPlanning: vi.fn(),
  createBrainTaskFromPlan: vi.fn(),
  planBrainTask: vi.fn()
}));
vi.mock("./TaskPlanReview", () => ({
  TaskPlanReview: (props: Record<string, unknown>) => {
    const draft = props.draft as TaskPlanDraft;
    return (
      <div data-testid="plan-review" data-title={draft.title} data-error={String(props.error)}>
        <button onClick={() => (props.onAnswerChange as (id: string, answer: string) => void)("question-1", "Postgres")}>review-answer</button>
        <button onClick={() => (props.onFeedbackChange as (value: string) => void)("Add rollback")}>review-feedback</button>
        <button onClick={() => (props.onDraftChange as (draft: TaskPlanDraft) => void)({ ...draft, title: "Edited title" })}>review-edit</button>
        <button onClick={() => (props.onRefine as () => void)()}>review-refine</button>
        <button onClick={() => (props.onApprove as () => void)()}>review-approve</button>
        <button onClick={() => (props.onBack as () => void)()}>review-back</button>
      </div>
    );
  }
}));

const draft: TaskPlanDraft = {
  provider: "claude",
  providerLabel: "Claude Code",
  sessionId: "session-1",
  generatedAt: "2026-08-03T00:00:00.000Z",
  title: "Solid coverage",
  type: "feature",
  profile: "full",
  description: "Raise coverage",
  motivation: "Prevent regressions",
  requirements: "Reach 80%",
  design: "Test boundaries",
  breakdown: "Add tests",
  checks: ["npm test"],
  assumptions: ["CI available"],
  questions: [{
    id: "question-1",
    question: "Which database?",
    options: ["Postgres", "SQLite"],
    recommendedOption: "Postgres"
  }]
};

const createdTask: BrainTask = {
  id: "task-1",
  title: draft.title,
  type: draft.type,
  status: "definition",
  contextRepositoryPaths: [],
  definition: { description: draft.description, motivation: draft.motivation },
  requirements: { content: draft.requirements, approvedAt: null },
  design: { content: draft.design, approvedAt: null },
  breakdown: { content: draft.breakdown, approvedAt: null },
  verificationChecks: draft.checks,
  planning: { profile: draft.profile, provider: "claude", brief: "Raise coverage", generatedAt: draft.generatedAt, assumptions: draft.assumptions },
  implementation: { log: [], runs: [] },
  decisions: [],
  git: { branch: null, prUrl: null },
  claudeSessionId: draft.sessionId,
  createdAt: draft.generatedAt,
  updatedAt: draft.generatedAt
};

function renderComposer(overrides: Partial<React.ComponentProps<typeof TaskPlanningComposer>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const props = {
    projectId: "alpha",
    projects: [createProjectFixture("alpha"), createProjectFixture("beta")],
    canCancel: true,
    onStageChange: vi.fn(),
    onCancel: vi.fn(),
    onCreated: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
  const view = renderWithTheme(
    <QueryClientProvider client={queryClient}>
      <TaskPlanningComposer {...props} />
    </QueryClientProvider>
  );
  return { ...view, props };
}

describe("TaskPlanningComposer", () => {
  beforeEach(() => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000002");
    vi.mocked(planBrainTask).mockResolvedValue(draft);
    vi.mocked(createBrainTaskFromPlan).mockResolvedValue(createdTask);
    vi.mocked(cancelBrainTaskPlanning).mockResolvedValue({ ok: true });
  });

  it("plans, refines, approves and returns to the brief", async () => {
    const user = userEvent.setup();
    const { props } = renderComposer();
    const analyze = screen.getByRole("button", { name: "Analyze and prepare the plan" });
    expect(analyze).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "What do you want to change or achieve?" }), {
      target: { value: "Raise coverage safely" }
    });
    await user.click(screen.getByText("Context and preferences"));
    fireEvent.mouseDown(screen.getAllByRole("combobox")[0]!);
    await user.click(screen.getByRole("option", { name: "Complete" }));
    await user.click(analyze);
    expect(await screen.findByTestId("plan-review")).toHaveAttribute("data-title", draft.title);

    await user.click(screen.getByText("review-answer"));
    await user.click(screen.getByText("review-feedback"));
    await user.click(screen.getByText("review-edit"));
    await user.click(screen.getByText("review-refine"));
    expect(planBrainTask).toHaveBeenLastCalledWith(
      "alpha",
      expect.objectContaining({
        brief: "Raise coverage safely",
        profile: "full",
        feedback: "Add rollback",
        answers: { "question-1": "Postgres" },
        currentDraft: expect.objectContaining({ title: "Edited title" })
      }),
      expect.any(AbortSignal)
    );

    await user.click(screen.getByText("review-approve"));
    expect(createBrainTaskFromPlan).toHaveBeenCalledWith(
      "alpha",
      expect.objectContaining({
        title: draft.title,
        clarifications: [{ question: "Which database?", answer: "Postgres" }]
      })
    );
    expect(props.onCreated).toHaveBeenCalledWith(
      createdTask,
      undefined,
      undefined,
      expect.objectContaining({ client: expect.any(QueryClient) })
    );
    await user.click(screen.getByText("review-back"));
    expect(screen.getByRole("button", { name: "Analyze and prepare the plan" })).toBeVisible();
  }, 20_000);

  it("surfaces planning and creation failures", async () => {
    const user = userEvent.setup();
    vi.mocked(planBrainTask)
      .mockRejectedValueOnce("offline")
      .mockResolvedValueOnce(draft);
    vi.mocked(createBrainTaskFromPlan).mockRejectedValueOnce(new Error("create failed"));
    renderComposer();
    fireEvent.change(screen.getByRole("textbox", { name: "What do you want to change or achieve?" }), {
      target: { value: "Raise coverage safely" }
    });
    await user.click(screen.getByRole("button", { name: "Analyze and prepare the plan" }));
    expect(await screen.findByText("Operation failed")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Analyze and prepare the plan" }));
    expect(await screen.findByTestId("plan-review")).toBeVisible();
    await user.click(screen.getByText("review-approve"));
    expect(await screen.findByTestId("plan-review")).toHaveAttribute("data-error", "create failed");
  });

  it("aborts and reports an in-flight planning request when cancelled", async () => {
    const user = userEvent.setup();
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(planBrainTask).mockImplementation((_projectId, _input, signal) => {
      capturedSignal = signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    });
    const { props } = renderComposer();
    fireEvent.change(screen.getByRole("textbox", { name: "What do you want to change or achieve?" }), {
      target: { value: "Raise coverage safely" }
    });
    await user.click(screen.getByRole("button", { name: "Analyze and prepare the plan" }));
    await user.click(await screen.findByRole("button", { name: "Stop analysis" }));
    expect(capturedSignal?.aborted).toBe(true);
    expect(cancelBrainTaskPlanning).toHaveBeenCalledWith(
      "alpha",
      "00000000-0000-4000-8000-000000000002",
    );
    expect(props.onCancel).toHaveBeenCalled();
  });
});
