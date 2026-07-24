import type {
  WorkflowDefinition,
  WorkflowNode
} from "./types.js";
import { getString, getStringArray } from "./value.js";

const EXECUTABLE_NODE_TYPES = new Set<WorkflowNode["type"]>([
  "git.fetch",
  "git.pull",
  "git.pullDevelop",
  "git.push",
  "docker.up",
  "docker.rebuild",
  "docker.stop",
  "terminal.command"
]);

export class WorkflowDefinitionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowDefinitionValidationError";
  }
}

export function getExecutableWorkflowNodes(workflow: WorkflowDefinition): WorkflowNode[] {
  const errors: string[] = [];
  const nodesById = new Map<string, WorkflowNode>();

  for (const node of workflow.nodes) {
    if (nodesById.has(node.id)) {
      errors.push(`node id "${node.id}" is used more than once`);
    }
    nodesById.set(node.id, node);
  }

  const triggerNodes = workflow.nodes.filter((node) => node.type === "trigger.manual");
  if (triggerNodes.length !== 1) {
    errors.push("the workflow must contain exactly one manual trigger");
  }

  if (!workflow.nodes.some((node) => EXECUTABLE_NODE_TYPES.has(node.type))) {
    errors.push("add at least one Git, Docker or terminal action");
  }

  for (const node of workflow.nodes) {
    if (node.type === "terminal.command" && !getString(node.config.command, "")) {
      errors.push(`terminal node "${node.name}" has no command`);
    }

    if (
      node.type === "repository.select"
      && getString(node.config.mode, "all") === "manual"
      && getStringArray(node.config.projectIds).length === 0
    ) {
      errors.push(`repository node "${node.name}" has an empty manual selection`);
    }
  }

  const incomingEdges = new Map<string, number>();
  const outgoingEdges = new Map<string, string>();

  for (const edge of workflow.edges) {
    if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) {
      errors.push(`connection "${edge.id}" references a missing node`);
      continue;
    }

    if (edge.source === edge.target) {
      errors.push(`node "${nodesById.get(edge.source)?.name ?? edge.source}" cannot connect to itself`);
      continue;
    }

    if (outgoingEdges.has(edge.source)) {
      errors.push(`node "${nodesById.get(edge.source)?.name ?? edge.source}" has more than one outgoing connection`);
    } else {
      outgoingEdges.set(edge.source, edge.target);
    }

    const incomingCount = (incomingEdges.get(edge.target) ?? 0) + 1;
    incomingEdges.set(edge.target, incomingCount);
    if (incomingCount > 1) {
      errors.push(`node "${nodesById.get(edge.target)?.name ?? edge.target}" has more than one incoming connection`);
    }
  }

  const triggerNode = triggerNodes[0];
  if (triggerNode && (incomingEdges.get(triggerNode.id) ?? 0) > 0) {
    errors.push("the manual trigger must be the first node");
  }

  for (const node of workflow.nodes) {
    if (node.type === "output.summary" && outgoingEdges.has(node.id)) {
      errors.push(`summary node "${node.name}" must be the last node`);
    }
  }

  const orderedNodes: WorkflowNode[] = [];
  const visitedNodeIds = new Set<string>();
  let currentNode: WorkflowNode | undefined = triggerNode;

  while (currentNode && !visitedNodeIds.has(currentNode.id)) {
    orderedNodes.push(currentNode);
    visitedNodeIds.add(currentNode.id);
    currentNode = nodesById.get(outgoingEdges.get(currentNode.id) ?? "");
  }

  if (currentNode) {
    errors.push("the workflow contains a cycle");
  }

  const disconnectedNodes = workflow.nodes.filter((node) => !visitedNodeIds.has(node.id));
  if (triggerNode && disconnectedNodes.length > 0) {
    const names = disconnectedNodes.slice(0, 3).map((node) => `"${node.name}"`).join(", ");
    const remainingCount = disconnectedNodes.length - 3;
    errors.push(
      `connect every node to the manual trigger; disconnected: ${names}${remainingCount > 0 ? ` and ${remainingCount} more` : ""}`
    );
  }

  if (errors.length > 0) {
    throw new WorkflowDefinitionValidationError(`Workflow cannot run: ${errors.join(". ")}`);
  }

  return orderedNodes;
}
