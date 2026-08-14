import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkflow, fetchWorkflowRuns, fetchWorkflows } from "../../api/workflows";
import { createProjectFixture } from "../../test/projectFixture";
import { renderWithTheme } from "../../test/render";
import type { WorkflowDefinition, WorkflowRun } from "../../types/workflows";
import { AutomationPage } from "./AutomationPage";

vi.mock("../../api/workflows", () => ({
  createWorkflow: vi.fn(),
  fetchWorkflowRuns: vi.fn(),
  fetchWorkflows: vi.fn()
}));
vi.mock("./AutomationWorkflowEditor", async () => {
  const React = await import("react");

  return {
    AutomationWorkflowEditor: (props: Record<string, unknown>) => {
    const workflow = props.workflow as WorkflowDefinition;
    const [runOpen, setRunOpen] = React.useState(false);
    return (
      <div data-testid={`editor-${workflow.id}`} data-runs={(props.runs as WorkflowRun[]).length}>
        <span data-testid="editor-revision">{workflow.updatedAt}</span>
        <button onClick={() => setRunOpen(true)}>editor-open-run</button>
        {runOpen ? <div role="dialog" aria-label="Mock run">run-live</div> : null}
        <button onClick={() => (props.onDirtyChange as (dirty: boolean) => void)(true)}>editor-dirty</button>
        <button onClick={() => (props.onDirtyChange as (dirty: boolean) => void)(false)}>editor-clean</button>
        <button onClick={() => void (props.onDeleted as () => Promise<void>)()}>editor-deleted</button>
      </div>
    );
    }
  };
});
vi.mock("./AutomationWorkflowList", () => ({
  AutomationWorkflowList: (props: Record<string, unknown>) => (
    <div data-testid="workflow-list">
      <button onClick={() => (props.onSelectWorkflow as (id: string) => void)("alpha")}>select-alpha</button>
      <button onClick={() => (props.onSelectWorkflow as (id: string) => void)("beta")}>select-beta</button>
      <button onClick={() => (props.onCreateWorkflow as () => void)()}>list-create</button>
    </div>
  )
}));
vi.mock("./CreateAutomationDialog", () => ({
  CreateAutomationDialog: (props: Record<string, unknown>) => props.open ? (
    <div data-testid="create-dialog" data-error={String(props.error)}>
      <button onClick={() => (props.onCreate as (draft: unknown) => void)({
        name: "Created",
        description: "",
        active: false,
        nodes: [],
        edges: []
      })}>dialog-create</button>
      <button onClick={() => (props.onClose as () => void)()}>dialog-close</button>
    </div>
  ) : null
}));

const alpha: WorkflowDefinition = {
  id: "alpha",
  name: "Alpha workflow",
  description: "",
  active: true,
  nodes: [],
  edges: [],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z"
};
const beta = { ...alpha, id: "beta", name: "Beta workflow" };
const run: WorkflowRun = {
  id: "run-1",
  workflowId: "alpha",
  workflowName: "Alpha workflow",
  mode: "run",
  status: "running",
  startedAt: "2026-08-03T00:00:00.000Z",
  completedAt: "",
  durationMs: 0,
  steps: [],
  summary: { selectedProjects: 1, succeeded: 0, failed: 0, skipped: 0, commands: 1 },
  statusMessage: null
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return renderWithTheme(
    <QueryClientProvider client={queryClient}>
      <AutomationPage projects={[createProjectFixture("project")]} />
    </QueryClientProvider>
  );
}

describe("AutomationPage", () => {
  beforeEach(() => {
    vi.mocked(fetchWorkflows).mockResolvedValue({ workflows: [alpha, beta] });
    vi.mocked(fetchWorkflowRuns).mockResolvedValue({ runs: [run] });
    vi.mocked(createWorkflow).mockResolvedValue({ ...alpha, id: "created", name: "Created" });
  });

  it("coordinates selection, dirty-change confirmation, creation and deletion", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByTestId("editor-alpha")).toHaveAttribute("data-runs", "1");

    await user.click(screen.getByRole("button", { name: /Workflow attivo/ }));
    await user.click(screen.getByText("select-alpha"));
    expect(screen.getByTestId("editor-alpha")).toBeVisible();
    await user.click(screen.getByText("select-beta"));
    expect(await screen.findByTestId("editor-beta")).toBeVisible();

    await user.click(screen.getByText("editor-dirty"));
    const beforeUnload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(beforeUnload);
    expect(beforeUnload.defaultPrevented).toBe(true);

    await user.click(screen.getByRole("button", { name: /Workflow attivo/ }));
    await user.click(screen.getByText("select-alpha"));
    expect(screen.getByRole("dialog", { name: "Modifiche non salvate" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Resta qui" }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog", { name: "Modifiche non salvate" }));
    expect(screen.getByTestId("editor-beta")).toBeVisible();

    await user.click(screen.getByText("select-alpha"));
    await user.click(screen.getByRole("button", { name: "Scarta e continua" }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog", { name: "Modifiche non salvate" }));
    expect(await screen.findByTestId("editor-alpha")).toBeVisible();

    await user.click(screen.getByText("editor-dirty"));
    await user.click(screen.getByRole("button", { name: /Workflow attivo/ }));
    await user.click(screen.getByText("list-create"));
    await user.click(screen.getByRole("button", { name: "Scarta e continua" }));
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog", { name: "Modifiche non salvate" }));
    expect(screen.getByTestId("create-dialog")).toBeVisible();
    await user.click(screen.getByText("dialog-create"));
    expect(createWorkflow).toHaveBeenCalledWith(expect.objectContaining({ name: "Created" }));

    await user.click(screen.getByText("editor-deleted"));
    await user.click(screen.getByRole("button", { name: "Aggiorna workflow" }));
    expect(fetchWorkflows).toHaveBeenCalled();
    expect(fetchWorkflowRuns).toHaveBeenCalled();
  }, 20_000);

  it("renders empty and failed states and exposes creation errors", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchWorkflows).mockResolvedValueOnce({ workflows: [] });
    vi.mocked(fetchWorkflowRuns).mockRejectedValueOnce(new Error("runs offline"));
    vi.mocked(createWorkflow).mockRejectedValueOnce(new Error("create failed"));
    renderPage();

    expect(await screen.findByText("Nessun workflow selezionato")).toBeVisible();
    expect(await screen.findByText("runs offline")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Crea automazione" }));
    await user.click(screen.getByText("dialog-create"));
    expect(await screen.findByTestId("create-dialog")).toHaveAttribute("data-error", "create failed");
    await user.click(screen.getByText("dialog-close"));
  });

  it("shows workflow loading errors", async () => {
    vi.mocked(fetchWorkflows).mockRejectedValueOnce(new Error("workflows offline"));
    vi.mocked(fetchWorkflowRuns).mockResolvedValueOnce({ runs: [] });
    renderPage();
    expect(await screen.findByText("workflows offline")).toBeVisible();
  });

  it("keeps the live run dialog open when a workflow refresh changes its revision", async () => {
    const user = userEvent.setup();
    const refreshedAlpha = { ...alpha, updatedAt: "2026-08-04T00:00:00.000Z" };
    vi.mocked(fetchWorkflows)
      .mockResolvedValueOnce({ workflows: [alpha, beta] })
      .mockResolvedValue({ workflows: [refreshedAlpha, beta] });
    renderPage();

    expect(await screen.findByTestId("editor-alpha")).toBeVisible();
    await user.click(screen.getByText("editor-open-run"));
    expect(screen.getByRole("dialog", { name: "Mock run" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Aggiorna workflow" }));

    expect(await screen.findByText(refreshedAlpha.updatedAt)).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Mock run" })).toBeVisible();
  });
});
