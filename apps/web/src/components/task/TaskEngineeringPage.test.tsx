import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBrainTasks } from "../../api/brain";
import { createProjectFixture } from "../../test/projectFixture";
import { renderWithTheme } from "../../test/render";
import type { BrainTask } from "../../types/brain";
import { TaskEngineeringPage } from "./TaskEngineeringPage";

vi.mock("../../api/brain", () => ({ fetchBrainTasks: vi.fn() }));
vi.mock("./TaskList", () => ({
  TaskList: (props: Record<string, unknown>) => (
    <div data-testid="task-list" data-count={(props.tasks as BrainTask[]).length}>
      <button onClick={() => (props.onSelect as (id: string) => void)("task-1")}>select-task</button>
    </div>
  )
}));
vi.mock("./TaskPlanningComposer", () => ({
  TaskPlanningComposer: (props: Record<string, unknown>) => (
    <div data-testid={`composer-${String(props.projectId)}`} data-cancel={String(props.canCancel)}>
      <button onClick={() => (props.onCancel as () => void)()}>composer-cancel</button>
      <button onClick={() => void (props.onCreated as (task: BrainTask) => Promise<void>)(task)}>composer-created</button>
    </div>
  )
}));
vi.mock("./TaskWorkbench", () => ({
  TaskWorkbench: (props: Record<string, unknown>) => (
    <div data-testid={`workbench-${(props.task as BrainTask).id}`}>
      <button onClick={() => void (props.onChanged as () => Promise<void>)()}>workbench-refresh</button>
    </div>
  )
}));

const task: BrainTask = {
  id: "task-1",
  title: "Solid tests",
  type: "feature",
  status: "definition",
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
  updatedAt: "2026-08-03T00:00:00.000Z"
};

function renderPage(projects = [createProjectFixture("alpha"), createProjectFixture("beta")]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return renderWithTheme(
    <QueryClientProvider client={queryClient}>
      <TaskEngineeringPage projects={projects} />
    </QueryClientProvider>
  );
}

describe("TaskEngineeringPage", () => {
  beforeEach(() => {
    vi.mocked(fetchBrainTasks).mockImplementation(async (projectId) => ({
      projectPath: `/workspace/${projectId}`,
      projectName: projectId,
      remoteUrl: null,
      tasks: projectId === "alpha" ? [task] : []
    }));
  });

  it("switches repositories, refreshes and coordinates creation", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByTestId("workbench-task-1")).toBeVisible();
    await user.click(screen.getByText("workbench-refresh"));
    await user.click(screen.getByRole("button", { name: "Refresh tasks" }));

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Repository" }));
    await user.click(screen.getByRole("option", { name: "beta" }));
    expect(await screen.findByTestId("composer-beta")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "New task" }));
    expect(screen.getByTestId("composer-beta")).toHaveAttribute("data-cancel", "false");
    await user.click(screen.getByText("composer-cancel"));
    await user.click(screen.getByRole("button", { name: "New task" }));
    await user.click(screen.getByText("composer-created"));
    expect(fetchBrainTasks).toHaveBeenCalledWith("beta");
  });

  it("shows query failures and handles a workspace without projects", async () => {
    vi.mocked(fetchBrainTasks).mockRejectedValueOnce(new Error("tasks offline"));
    const first = renderPage([createProjectFixture("alpha")]);
    expect(await screen.findByText("tasks offline")).toBeVisible();
    first.unmount();

    renderPage([]);
    expect(screen.getByRole("button", { name: "New task" })).toBeDisabled();
    expect(screen.getByTestId("composer-")).toBeVisible();
  });
});
