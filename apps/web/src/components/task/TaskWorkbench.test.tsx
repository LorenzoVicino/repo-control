import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { approveBrainTask, updateBrainTask } from "../../api/brain";
import { createProjectFixture } from "../../test/projectFixture";
import { renderWithTheme } from "../../test/render";
import type { BrainTask } from "../../types/brain";
import { TaskWorkbench } from "./TaskWorkbench";

vi.mock("../../api/brain", () => ({
  approveBrainTask: vi.fn(),
  updateBrainTask: vi.fn()
}));
vi.mock("./ImplementationPanel", () => ({
  ImplementationPanel: (props: Record<string, unknown>) => (
    <div data-testid="implementation-panel">
      <button onClick={() => void (props.onChanged as () => Promise<void>)()}>implementation-refresh</button>
    </div>
  )
}));

const task: BrainTask = {
  id: "task-1",
  title: "Coverage",
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
const projects = [
  createProjectFixture("alpha", { path: "/workspace/alpha" }),
  createProjectFixture("beta", { path: "/workspace/beta", isClean: false })
];

function renderWorkbench(currentTask: BrainTask = task) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const onChanged = vi.fn().mockResolvedValue(undefined);
  const view = renderWithTheme(
    <QueryClientProvider client={queryClient}>
      <TaskWorkbench projectId="alpha" projects={projects} task={currentTask} onChanged={onChanged} />
    </QueryClientProvider>
  );
  return { ...view, onChanged };
}

describe("TaskWorkbench", () => {
  beforeEach(() => {
    vi.mocked(updateBrainTask).mockResolvedValue(task);
    vi.mocked(approveBrainTask).mockResolvedValue({ ...task, status: "requirements" });
  });

  it("saves definition and context, advances phases and reaches implementation", async () => {
    const user = userEvent.setup();
    const { onChanged } = renderWorkbench();
    fireEvent.change(screen.getByRole("textbox", { name: "Titolo" }), { target: { value: "Coverage 80" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Descrizione" }), { target: { value: "New description" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Motivazione" }), { target: { value: "New motivation" } });
    await user.click(screen.getByRole("button", { name: "Salva" }));
    await waitFor(() => expect(updateBrainTask).toHaveBeenCalledWith("alpha", "task-1", {
      title: "Coverage 80",
      definition: { description: "New description", motivation: "New motivation" }
    }));

    const contextInput = screen.getByRole("combobox", { name: "Repository di contesto" });
    fireEvent.change(contextInput, { target: { value: "beta" } });
    await user.click(await screen.findByRole("option", { name: /beta/ }));
    await user.click(screen.getByRole("button", { name: "Salva contesto" }));
    await waitFor(() => expect(updateBrainTask).toHaveBeenCalledWith("alpha", "task-1", { contextProjectIds: ["beta"] }));

    vi.mocked(approveBrainTask)
      .mockResolvedValueOnce({ ...task, status: "requirements" })
      .mockResolvedValueOnce({ ...task, status: "done" });
    await user.click(screen.getByRole("button", { name: "Approva e continua" }));
    const requirements = await screen.findByRole("textbox", { name: "Requisiti" });
    fireEvent.change(requirements, { target: { value: "Updated requirements" } });
    await user.click(screen.getByRole("button", { name: "Salva" }));
    await waitFor(() => expect(updateBrainTask).toHaveBeenCalledWith("alpha", "task-1", {
      phase: "requirements",
      content: "Updated requirements"
    }));
    await user.click(screen.getByRole("button", { name: "Approva e continua" }));
    expect(await screen.findByTestId("implementation-panel")).toBeVisible();
    expect(approveBrainTask).toHaveBeenLastCalledWith("alpha", "task-1", "requirements");
    expect(onChanged).toHaveBeenCalled();
  }, 20_000);

  it("surfaces save, approval and context errors", async () => {
    const user = userEvent.setup();
    vi.mocked(updateBrainTask).mockRejectedValueOnce(new Error("save failed"));
    renderWorkbench();
    await user.click(screen.getByRole("button", { name: "Salva" }));
    expect(await screen.findByText("save failed")).toBeVisible();

    vi.mocked(updateBrainTask).mockResolvedValueOnce(task);
    vi.mocked(approveBrainTask).mockRejectedValueOnce("approval failed");
    await user.click(screen.getByRole("button", { name: "Approva e continua" }));
    expect(await screen.findByText("Operazione non riuscita")).toBeVisible();

    fireEvent.change(screen.getByRole("combobox", { name: "Repository di contesto" }), { target: { value: "beta" } });
    await user.click(await screen.findByRole("option", { name: /beta/ }));
    vi.mocked(updateBrainTask).mockRejectedValueOnce(new Error("context failed"));
    await user.click(screen.getByRole("button", { name: "Salva contesto" }));
    expect(await screen.findByText("context failed")).toBeVisible();
  });

  it("closes implementation tasks and renders completed tasks without another action", async () => {
    const user = userEvent.setup();
    const implementation = renderWorkbench({ ...task, status: "implementation" });
    expect(screen.getByTestId("implementation-panel")).toBeVisible();
    vi.mocked(approveBrainTask).mockResolvedValueOnce({ ...task, status: "done" });
    await user.click(screen.getByRole("button", { name: "Chiudi task" }));
    expect(approveBrainTask).toHaveBeenCalledWith("alpha", "task-1", "implementation");
    implementation.unmount();

    renderWorkbench({ ...task, status: "done" });
    expect(screen.getByText("Completato")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Chiudi task" })).not.toBeInTheDocument();
  });
});
