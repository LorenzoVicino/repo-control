import { MarkerType, type Connection, type Edge } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkflowDefinition, WorkflowNode } from "../../types/workflows";
import {
  buildWorkflowDraft,
  getConnectionSource,
  isLinearConnectionValid,
  toFlowEdge,
  toFlowEdges,
  toFlowNodes,
  toWorkflowDraft
} from "./automationWorkflowGraph";

const workflowNodes: WorkflowNode[] = [
  createWorkflowNode("trigger", "trigger.manual", 0),
  createWorkflowNode("fetch", "git.fetch", 200),
  createWorkflowNode("summary", "output.summary", 400)
];
const flowNodes = toFlowNodes(workflowNodes);

describe("automation workflow graph", () => {
  it("maps persisted workflow data to and from React Flow", () => {
    const edges = [{ id: "edge-1", source: "trigger", target: "fetch" }];
    const flowEdges = toFlowEdges(edges);

    expect(flowNodes[0]).toMatchObject({ id: "trigger", type: "automation", position: { x: 0, y: 20 } });
    expect(flowEdges[0]).toMatchObject({ type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } });

    const draft = buildWorkflowDraft("  Workflow  ", "  Description  ", true, flowNodes, flowEdges);
    expect(draft).toMatchObject({ name: "Workflow", description: "Description", active: true });
    expect(draft.nodes[0]).toMatchObject({ id: "trigger", position: { x: 0, y: 20 } });
  });

  it("creates edges and rejects fan-out, fan-in, self-links and cycles", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
    const existing: Edge[] = [
      { id: "one", source: "trigger", target: "fetch" },
      { id: "two", source: "fetch", target: "summary" }
    ];

    expect(toFlowEdge({ source: "trigger", target: "fetch", sourceHandle: null, targetHandle: null })).toMatchObject({
      id: "edge-trigger-fetch-00000000-0000-4000-8000-000000000001",
      source: "trigger",
      target: "fetch"
    });
    expect(isLinearConnectionValid(connection("summary", "trigger"), existing)).toBe(false);
    expect(isLinearConnectionValid(connection("trigger", "other"), existing)).toBe(false);
    expect(isLinearConnectionValid(connection("other", "summary"), existing)).toBe(false);
    expect(isLinearConnectionValid(connection("other", "other"), existing)).toBe(false);
    expect(isLinearConnectionValid(connection("summary", "other"), existing)).toBe(true);
  });

  it("selects the rightmost connectable node and skips terminal nodes", () => {
    const existing: Edge[] = [{ id: "one", source: "trigger", target: "fetch" }];

    expect(getConnectionSource(flowNodes, existing, "trigger")?.id).toBe("fetch");
    expect(getConnectionSource(flowNodes, existing, "summary")?.id).toBe("fetch");
    expect(getConnectionSource(flowNodes, [...existing, { id: "two", source: "fetch", target: "summary" }], null)).toBeNull();
  });

  it("copies an existing workflow into an editable draft", () => {
    const workflow: WorkflowDefinition = {
      id: "workflow-1",
      name: "Workflow",
      description: "Description",
      active: false,
      nodes: workflowNodes,
      edges: [],
      createdAt: "2026-07-20T10:00:00.000Z",
      updatedAt: "2026-07-20T10:00:00.000Z"
    };

    expect(toWorkflowDraft(workflow)).toEqual({
      name: "Workflow",
      description: "Description",
      active: false,
      nodes: workflowNodes,
      edges: []
    });
  });
});

function createWorkflowNode(id: string, type: WorkflowNode["type"], x: number): WorkflowNode {
  return { id, type, name: id, position: { x, y: 20 }, config: {} };
}

function connection(source: string, target: string): Connection {
  return { source, target, sourceHandle: null, targetHandle: null };
}
