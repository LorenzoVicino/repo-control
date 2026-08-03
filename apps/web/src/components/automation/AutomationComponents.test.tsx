import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createProjectFixture } from "../../test/projectFixture";
import { renderWithTheme } from "../../test/render";
import type { WorkflowDefinition, WorkflowNode, WorkflowRun } from "../../types/workflows";
import { AutomationNodeInspector } from "./AutomationNodeInspector";
import { AutomationNodePalette } from "./AutomationNodePalette";
import { AutomationRunHistory } from "./AutomationRunHistory";
import { AutomationWorkflowList } from "./AutomationWorkflowList";
import { CreateAutomationDialog } from "./CreateAutomationDialog";

function node(type: WorkflowNode["type"], config: Record<string, unknown> = {}): WorkflowNode {
  return { id: `node-${type}`, type, name: type, position: { x: 0, y: 0 }, config };
}

function run(status: WorkflowRun["status"], id = status): WorkflowRun {
  return {
    id,
    workflowId: "workflow-1",
    workflowName: "Release",
    mode: id === "warning" ? "dry-run" : "run",
    status,
    startedAt: "2026-08-03T09:00:00.000Z",
    completedAt: status === "running" ? "" : "2026-08-03T09:01:00.000Z",
    durationMs: 60_000,
    steps: [],
    summary: { selectedProjects: 2, succeeded: 1, failed: 0, skipped: 0, commands: 2 },
    statusMessage: null
  };
}

const workflow: WorkflowDefinition = {
  id: "workflow-1",
  name: "Release",
  description: "Ship production",
  active: true,
  nodes: [
    node("trigger.manual"),
    node("git.fetch"),
    node("output.summary")
  ],
  edges: [
    { id: "one", source: "node-trigger.manual", target: "node-git.fetch" },
    { id: "two", source: "node-git.fetch", target: "node-output.summary" }
  ],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z"
};

describe("automation supporting components", () => {
  it("builds workflows from every creation template and trims user input", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("template-id");
    const onCreate = vi.fn();
    const first = renderWithTheme(
      <CreateAutomationDialog open loading={false} error={null} onClose={vi.fn()} onCreate={onCreate} />
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Nome" }), { target: { value: "  Sync release  " } });
    fireEvent.change(screen.getByRole("textbox", { name: "Descrizione" }), { target: { value: "  Safe sync  " } });
    fireEvent.click(screen.getByRole("button", { name: /Sincronizza preferiti/ }));
    fireEvent.click(screen.getByRole("button", { name: "Crea workflow" }));
    expect(onCreate).toHaveBeenLastCalledWith(expect.objectContaining({
      name: "Sync release",
      description: "Safe sync",
      nodes: expect.arrayContaining([
        expect.objectContaining({ type: "repository.select", config: expect.objectContaining({ mode: "favorites" }) }),
        expect.objectContaining({ type: "repository.filter", config: expect.objectContaining({ clean: "clean" }) })
      ])
    }));
    first.unmount();

    const dockerCreate = vi.fn();
    renderWithTheme(
      <CreateAutomationDialog open loading={false} error="Previous failure" onClose={vi.fn()} onCreate={dockerCreate} />
    );
    expect(screen.getByText("Previous failure")).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Nome" }), { target: { value: "Docker" } });
    fireEvent.click(screen.getByRole("button", { name: /Avvia Docker/ }));
    fireEvent.click(screen.getByRole("button", { name: "Crea workflow" }));
    expect(dockerCreate).toHaveBeenCalledWith(expect.objectContaining({
      nodes: expect.arrayContaining([
        expect.objectContaining({ type: "repository.filter", config: expect.objectContaining({ docker: "yes" }) }),
        expect.objectContaining({ type: "docker.up" })
      ])
    }));
  });

  it("filters the node library, disables duplicate triggers and emits selections", async () => {
    const onAddNode = vi.fn();
    const onClose = vi.fn();
    renderWithTheme(
      <AutomationNodePalette nodeTypes={["trigger.manual"]} onAddNode={onAddNode} onClose={onClose} />
    );

    expect(screen.getByRole("button", { name: /Avvio manuale/ })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Cerca nella libreria nodi" }), { target: { value: "Git fetch" } });
    fireEvent.click(screen.getByRole("button", { name: /Git fetch/ }));
    expect(onAddNode).toHaveBeenCalledWith("git.fetch");
    fireEvent.change(screen.getByRole("textbox", { name: "Cerca nella libreria nodi" }), { target: { value: "nothing-here" } });
    expect(screen.getByText("Nessun passaggio trovato")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Chiudi libreria nodi" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("edits input-node configuration and handles an empty inspector", async () => {
    const user = userEvent.setup();
    const onUpdateNode = vi.fn();
    const onDeleteNode = vi.fn();
    const onClose = vi.fn();
    const empty = renderWithTheme(
      <AutomationNodeInspector node={null} projects={[]} onClose={onClose} onUpdateNode={onUpdateNode} onDeleteNode={onDeleteNode} />
    );
    expect(screen.getByText("Nessun nodo selezionato")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Chiudi configurazione nodo" }));
    empty.unmount();

    renderWithTheme(
      <AutomationNodeInspector
        node={node("input.text", { key: "Bad Key", required: true, multiline: false })}
        projects={[]}
        onClose={onClose}
        onUpdateNode={onUpdateNode}
        onDeleteNode={onDeleteNode}
      />
    );
    expect(screen.getByText(/Inizia con una lettera minuscola/)).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Nome nodo" }), { target: { value: "Input release" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Chiave" }), { target: { value: "Release_Name" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Etichetta" }), { target: { value: "Release" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Descrizione" }), { target: { value: "Describe" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Placeholder" }), { target: { value: "v1.0" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Valore predefinito" }), { target: { value: "main" } });
    await user.click(screen.getByRole("switch", { name: "Input obbligatorio" }));
    await user.click(screen.getByRole("switch", { name: "Testo su più righe" }));
    await user.click(screen.getByRole("button", { name: "Elimina nodo" }));
    expect(onUpdateNode).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ key: "release_name" }) }));
    expect(onDeleteNode).toHaveBeenCalledWith("node-input.text");
  });

  it("renders and updates repository, filter, pull and terminal node variants", async () => {
    const user = userEvent.setup();
    const update = vi.fn();
    const callbacks = { onClose: vi.fn(), onUpdateNode: update, onDeleteNode: vi.fn() };
    const projects = [createProjectFixture("alpha"), createProjectFixture("beta")];
    const selection = renderWithTheme(
      <AutomationNodeInspector
        node={node("repository.select", { mode: "manual", projectIds: ["alpha", "missing"] })}
        projects={projects}
        {...callbacks}
      />
    );
    expect(screen.getByRole("combobox", { name: "Repository" })).toBeVisible();
    selection.unmount();

    const filter = renderWithTheme(
      <AutomationNodeInspector node={node("repository.filter")} projects={projects} {...callbacks} />
    );
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Checkout" }));
    await user.click(screen.getByRole("option", { name: "Pulito" }));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ clean: "clean" }) }));
    expect(screen.getByRole("combobox", { name: "Sincronizzazione" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Docker Compose" })).toBeVisible();
    filter.unmount();

    const pull = renderWithTheme(
      <AutomationNodeInspector node={node("git.pull", { requireClean: true })} projects={[]} {...callbacks} />
    );
    await user.click(screen.getByRole("switch", { name: "Richiedi checkout pulito" }));
    pull.unmount();

    renderWithTheme(
      <AutomationNodeInspector node={node("terminal.command", { command: "npm test" })} projects={[]} {...callbacks} />
    );
    fireEvent.change(screen.getByRole("textbox", { name: "Comando" }), { target: { value: "npm run build" } });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ config: expect.objectContaining({ command: "npm run build" }) }));
  });

  it("lists, filters and selects workflows across loading and empty states", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const view = renderWithTheme(
      <AutomationWorkflowList
        workflows={[workflow, { ...workflow, id: "workflow-2", name: "Deploy", description: "Other" }]}
        runs={[run("success")]}
        selectedWorkflowId="workflow-1"
        loading={false}
        onSelectWorkflow={onSelect}
        onCreateWorkflow={vi.fn()}
      />
    );
    await user.click(screen.getByText("Release"));
    expect(onSelect).toHaveBeenCalledWith("workflow-1");
    await user.type(screen.getByRole("textbox", { name: "Cerca workflow" }), "missing");
    expect(screen.getByText(/Nessun risultato/)).toBeVisible();
    view.unmount();

    const empty = renderWithTheme(
      <AutomationWorkflowList workflows={[]} runs={[]} selectedWorkflowId={null} loading={false} onSelectWorkflow={vi.fn()} onCreateWorkflow={vi.fn()} />
    );
    expect(screen.getByText("Nessun workflow")).toBeVisible();
    empty.unmount();
    renderWithTheme(
      <AutomationWorkflowList workflows={[]} runs={[]} selectedWorkflowId={null} loading onSelectWorkflow={vi.fn()} onCreateWorkflow={vi.fn()} />
    );
    expect(screen.getByRole("progressbar")).toBeVisible();
  });

  it("renders every run status and lets users inspect history", async () => {
    const user = userEvent.setup();
    const onSelectRun = vi.fn();
    const statuses: WorkflowRun["status"][] = ["running", "failed", "warning", "cancelled", "interrupted", "success"];
    const view = renderWithTheme(
      <AutomationRunHistory runs={statuses.map((status) => run(status))} onSelectRun={onSelectRun} />
    );
    expect(screen.getByText("In corso…")).toBeVisible();
    await user.click(screen.getAllByRole("button")[0]!);
    expect(onSelectRun).toHaveBeenCalledWith(expect.objectContaining({ status: "running" }));
    view.unmount();

    renderWithTheme(<AutomationRunHistory runs={[]} onSelectRun={vi.fn()} />);
    expect(screen.getByText("Nessuna esecuzione registrata")).toBeVisible();
  });
});
