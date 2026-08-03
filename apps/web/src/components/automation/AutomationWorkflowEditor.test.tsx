import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelWorkflowRun,
  deleteWorkflow,
  executeWorkflow,
  fetchWorkflowRun,
  updateWorkflow
} from "../../api/workflows";
import { createProjectFixture } from "../../test/projectFixture";
import { renderWithTheme } from "../../test/render";
import type { WorkflowDefinition, WorkflowRun } from "../../types/workflows";
import { AutomationWorkflowEditor } from "./AutomationWorkflowEditor";

vi.mock("../../api/workflows", () => ({
  cancelWorkflowRun: vi.fn(),
  deleteWorkflow: vi.fn(),
  executeWorkflow: vi.fn(),
  fetchWorkflowRun: vi.fn(),
  updateWorkflow: vi.fn()
}));

vi.mock("@xyflow/react", async () => {
  const React = await import("react");
  return {
    addEdge: (edge: unknown, edges: unknown[]) => [...edges, edge],
    Background: () => null,
    BackgroundVariant: { Dots: "dots" },
    Controls: () => null,
    MarkerType: { ArrowClosed: "arrowclosed" },
    Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ReactFlow: (props: Record<string, unknown>) => {
      const nodes = props.nodes as Array<{ id: string }>;
      return (
        <div aria-label={String(props["aria-label"])}>
          {nodes.map((node) => (
            <button
              key={node.id}
              onClick={() => (props.onNodeClick as (event: unknown, node: unknown) => void)({}, node)}
            >
              select-{node.id}
            </button>
          ))}
          <button onClick={() => (props.onPaneClick as () => void)()}>flow-pane</button>
          <button onClick={() => (props.onNodesDelete as () => void)()}>nodes-deleted</button>
          <button onClick={() => (props.onConnect as (connection: unknown) => void)({
            source: "summary",
            target: "new-target",
            sourceHandle: null,
            targetHandle: null
          })}>connect-valid</button>
          <button onClick={() => (props.onConnect as (connection: unknown) => void)({
            source: "trigger",
            target: "fetch",
            sourceHandle: null,
            targetHandle: null
          })}>connect-invalid</button>
          <button onClick={() => void (props.onBeforeDelete as (input: unknown) => Promise<boolean>)({
            nodes,
            edges: []
          })}>delete-all</button>
          {props.children as React.ReactNode}
        </div>
      );
    },
    useEdgesState: (initial: unknown[]) => {
      const [value, setValue] = React.useState(initial);
      return [value, setValue, vi.fn()];
    },
    useNodesState: (initial: unknown[]) => {
      const [value, setValue] = React.useState(initial);
      return [value, setValue, vi.fn()];
    }
  };
});

vi.mock("./AutomationNode", () => ({ AutomationNode: () => null }));
vi.mock("./AutomationNodeInspector", () => ({
  AutomationNodeInspector: (props: Record<string, unknown>) => {
    const node = props.node as { id: string; name: string };
    return (
      <div data-testid="node-inspector">
        <span>{node.name}</span>
        <button onClick={() => (props.onClose as () => void)()}>inspector-close</button>
        <button onClick={() => (props.onUpdateNode as (node: unknown) => void)({ ...node, name: `${node.name} updated` })}>
          inspector-update
        </button>
        <button onClick={() => (props.onDeleteNode as (id: string) => void)(node.id)}>inspector-delete</button>
      </div>
    );
  }
}));
vi.mock("./AutomationNodePalette", () => ({
  AutomationNodePalette: (props: Record<string, unknown>) => (
    <div>
      <button onClick={() => (props.onAddNode as (type: string) => void)("trigger.manual")}>add-trigger</button>
      <button onClick={() => (props.onAddNode as (type: string) => void)("input.text")}>add-input</button>
      <button onClick={() => (props.onClose as () => void)()}>close-palette</button>
    </div>
  )
}));
vi.mock("./AutomationExecutionDialog", () => ({
  AutomationExecutionDialog: (props: Record<string, unknown>) => (
    <div data-testid={`execution-${String(props.mode)}`} data-save={String(props.willSaveChanges)}>
      <button onClick={() => (props.onSubmit as (inputs: Record<string, string>) => void)({ message: "ship" })}>
        submit-execution
      </button>
      <button onClick={() => (props.onClose as () => void)()}>close-execution</button>
    </div>
  )
}));
vi.mock("./AutomationRunHistory", () => ({
  AutomationRunHistory: (props: Record<string, unknown>) => (
    <div>
      {(props.runs as WorkflowRun[]).map((run) => (
        <button key={run.id} onClick={() => (props.onSelectRun as (run: WorkflowRun) => void)(run)}>
          history-{run.id}
        </button>
      ))}
    </div>
  )
}));
vi.mock("./AutomationRunDialog", () => ({
  AutomationRunDialog: (props: Record<string, unknown>) => props.run ? (
    <div data-testid={`run-dialog-${(props.run as WorkflowRun).id}`}>
      <button onClick={() => (props.onClose as () => void)()}>close-run</button>
      {props.onCancel ? <button onClick={() => (props.onCancel as () => void)()}>cancel-run</button> : null}
    </div>
  ) : null
}));

const workflow: WorkflowDefinition = {
  id: "workflow-1",
  name: "Release",
  description: "Ship safely",
  active: true,
  nodes: [
    { id: "trigger", type: "trigger.manual", name: "Trigger", position: { x: 0, y: 20 }, config: {} },
    { id: "fetch", type: "git.fetch", name: "Fetch", position: { x: 200, y: 20 }, config: {} },
    { id: "summary", type: "output.summary", name: "Summary", position: { x: 400, y: 20 }, config: {} }
  ],
  edges: [
    { id: "trigger-fetch", source: "trigger", target: "fetch" },
    { id: "fetch-summary", source: "fetch", target: "summary" }
  ],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z"
};

function createRun(status: WorkflowRun["status"], id = "run-1"): WorkflowRun {
  return {
    id,
    workflowId: workflow.id,
    workflowName: workflow.name,
    mode: "run",
    status,
    startedAt: "2026-08-03T00:00:00.000Z",
    completedAt: status === "running" ? "" : "2026-08-03T00:01:00.000Z",
    durationMs: status === "running" ? 0 : 60_000,
    steps: [],
    summary: { selectedProjects: 1, succeeded: status === "success" ? 1 : 0, failed: 0, skipped: 0, commands: 1 },
    statusMessage: null
  };
}

function renderEditor(element: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const view = renderWithTheme(
    <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
  );
  return { ...view, queryClient };
}

describe("AutomationWorkflowEditor", () => {
  beforeEach(() => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
    vi.mocked(updateWorkflow).mockResolvedValue(workflow);
    vi.mocked(executeWorkflow).mockResolvedValue(createRun("success"));
    vi.mocked(fetchWorkflowRun).mockResolvedValue(createRun("success"));
    vi.mocked(cancelWorkflowRun).mockResolvedValue({ ok: true });
    vi.mocked(deleteWorkflow).mockResolvedValue({ ok: true });
  });

  it("edits, saves, executes, inspects nodes and manages run history", async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    const onDeleted = vi.fn().mockResolvedValue(undefined);
    renderEditor(
      <AutomationWorkflowEditor
        workflow={workflow}
        projects={[createProjectFixture("alpha")]}
        runs={[createRun("success", "history-1")]}
        onDeleted={onDeleted}
        onDirtyChange={onDirtyChange}
      />
    );

    await user.clear(screen.getByRole("textbox", { name: "Nome workflow" }));
    expect(screen.getByRole("button", { name: "Esegui" })).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Nome workflow" }), "Release v2");
    await user.clear(screen.getByRole("textbox", { name: "Descrizione workflow" }));
    await user.type(screen.getByRole("textbox", { name: "Descrizione workflow" }), "Updated");
    expect(screen.getByLabelText("Modifiche non salvate")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Salva/ }));
    expect(updateWorkflow).toHaveBeenCalledWith(
      workflow.id,
      expect.objectContaining({ name: "Release v2", description: "Updated" })
    );

    vi.mocked(executeWorkflow).mockResolvedValueOnce(createRun("running"));
    await user.click(screen.getByRole("button", { name: "Esegui" }));
    expect(screen.getByTestId("execution-run")).toHaveAttribute("data-save", "true");
    await user.click(screen.getByText("submit-execution"));
    expect(executeWorkflow).toHaveBeenCalledWith(workflow.id, "run", { message: "ship" });
    expect(await screen.findByTestId("run-dialog-run-1")).toBeVisible();
    await user.click(screen.getByText("cancel-run"));
    expect(cancelWorkflowRun).toHaveBeenCalledWith("run-1");
    await user.click(screen.getByText("close-run"));

    await user.click(screen.getByRole("button", { name: "Aggiungi passaggio" }));
    await user.click(screen.getByText("add-trigger"));
    await user.click(screen.getByText("add-input"));
    expect(screen.getByTestId("node-inspector")).toBeVisible();
    await user.click(screen.getByText("inspector-update"));
    expect(screen.getByText("Input di testo updated")).toBeVisible();
    await user.click(screen.getByText("inspector-close"));

    await user.click(screen.getByText("select-fetch"));
    await user.click(screen.getByText("inspector-delete"));
    expect(screen.queryByText("select-fetch")).not.toBeInTheDocument();
    await user.click(screen.getByText("flow-pane"));
    await user.click(screen.getByText("nodes-deleted"));
    await user.click(screen.getByText("connect-invalid"));
    expect(screen.getByRole("alert")).toHaveTextContent("una sola entrata");

    await user.click(screen.getByRole("tab", { name: /Esecuzioni/ }));
    expect(screen.getByLabelText("Esecuzioni workflow")).toBeVisible();
    await user.click(screen.getByText("history-history-1"));
    expect(screen.getByTestId("run-dialog-history-1")).toBeVisible();
    await user.click(screen.getByText("close-run"));
    await user.click(screen.getByRole("button", { name: "Torna all’editor" }));

    await user.click(screen.getByRole("button", { name: "Elimina workflow" }));
    await user.click(screen.getByRole("button", { name: "Elimina" }));
    expect(deleteWorkflow).toHaveBeenCalledWith(workflow.id);
    expect(onDeleted).toHaveBeenCalled();
    expect(onDirtyChange).toHaveBeenCalledWith(true);
  }, 20_000);

  it("surfaces save, run, cancel and delete failures and protects the final node", async () => {
    const user = userEvent.setup();
    const oneNodeWorkflow = { ...workflow, nodes: [workflow.nodes[0]!], edges: [] };
    vi.mocked(updateWorkflow).mockRejectedValueOnce(new Error("save failed"));
    renderEditor(
      <AutomationWorkflowEditor
        workflow={oneNodeWorkflow}
        projects={[]}
        runs={[]}
        onDeleted={vi.fn().mockResolvedValue(undefined)}
        onDirtyChange={vi.fn()}
      />
    );

    await user.type(screen.getByRole("textbox", { name: "Descrizione workflow" }), " changed");
    await user.click(screen.getByRole("button", { name: /Salva/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("save failed");

    await user.click(screen.getByText("select-trigger"));
    await user.click(screen.getByText("inspector-delete"));
    expect(screen.getByRole("alert")).toHaveTextContent("almeno un nodo");
    await user.click(screen.getByText("delete-all"));

    vi.mocked(deleteWorkflow).mockRejectedValueOnce("unknown");
    await user.click(screen.getByRole("button", { name: "Elimina workflow" }));
    await user.click(screen.getByRole("button", { name: "Annulla" }));
    await user.click(await screen.findByRole(
      "button",
      { name: "Elimina workflow" },
      { timeout: 3_000 }
    ));
    await user.click(screen.getByRole("button", { name: "Elimina" }));
    expect(await screen.findByText("Operazione non riuscita")).toBeInTheDocument();
  }, 20_000);
});
