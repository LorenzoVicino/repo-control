import { MarkerType, type Connection, type Edge } from "@xyflow/react";
import type {
  WorkflowDefinition,
  WorkflowDraft,
  WorkflowNode
} from "../../types/workflows";
import type { AutomationFlowNode } from "./AutomationNode";

export function toFlowNodes(nodes: WorkflowNode[]): AutomationFlowNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: "automation",
    position: node.position,
    data: { workflowNode: node }
  }));
}

export function toFlowEdges(edges: WorkflowDefinition["edges"]): Edge[] {
  return edges.map((edge) => ({
    ...edge,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed }
  }));
}

export function toFlowEdge(connection: Connection): Edge {
  return {
    id: `edge-${connection.source}-${connection.target}-${crypto.randomUUID()}`,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
    type: "smoothstep",
    markerEnd: { type: MarkerType.ArrowClosed }
  };
}

export function buildWorkflowDraft(
  name: string,
  description: string,
  active: boolean,
  nodes: AutomationFlowNode[],
  edges: Edge[]
): WorkflowDraft {
  return {
    name: name.trim(),
    description: description.trim(),
    active,
    nodes: nodes.map((node) => ({ ...node.data.workflowNode, position: node.position })),
    edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target }))
  };
}

export function toWorkflowDraft(workflow: WorkflowDefinition): WorkflowDraft {
  return {
    name: workflow.name,
    description: workflow.description,
    active: workflow.active,
    nodes: workflow.nodes,
    edges: workflow.edges
  };
}

export function isLinearConnectionValid(connection: Edge | Connection, edges: Edge[]): boolean {
  const source = connection.source;
  const target = connection.target;

  if (!source || !target || source === target) return false;
  if (edges.some((edge) => edge.source === source || edge.target === target)) return false;

  const nextBySource = new Map(edges.map((edge) => [edge.source, edge.target]));
  let cursor: string | undefined = target;

  while (cursor) {
    if (cursor === source) return false;
    cursor = nextBySource.get(cursor);
  }

  return true;
}

export function getConnectionSource(
  nodes: AutomationFlowNode[],
  edges: Edge[],
  selectedNodeId: string | null
): AutomationFlowNode | null {
  const canConnect = (node: AutomationFlowNode) =>
    node.data.workflowNode.type !== "output.summary"
    && !edges.some((edge) => edge.source === node.id);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  if (selectedNode && canConnect(selectedNode)) return selectedNode;

  return [...nodes]
    .sort((left, right) => right.position.x - left.position.x)
    .find(canConnect) ?? null;
}
