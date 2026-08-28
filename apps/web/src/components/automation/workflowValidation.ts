import type {
  WorkflowEdge,
  WorkflowNode
} from "../../types/workflows";
import { getConfigString, getConfigStringArray } from "./automationNodeCatalog";
import { getWorkflowIssueIdentity } from "./workflowIssues";
import type { WorkflowIssue } from "./workflowIssues";
import { getWorkflowInputConfigurationIssue } from "./workflowInputs";

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

export type WorkflowValidationIssue = WorkflowIssue;

export type WorkflowValidationResult = {
  errors: WorkflowValidationIssue[];
  warnings: WorkflowValidationIssue[];
  orderedNodeIds: string[];
  isRunnable: boolean;
};

export function validateWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): WorkflowValidationResult {
  const errors: WorkflowValidationIssue[] = [];
  const warnings: WorkflowValidationIssue[] = [];
  const nodesById = new Map<string, WorkflowNode>();

  for (const node of nodes) {
    if (nodesById.has(node.id)) {
      errors.push({ code: "duplicateNodeId", values: { name: node.name }, nodeId: node.id });
    }
    nodesById.set(node.id, node);
  }

  const triggerNodes = nodes.filter((node) => node.type === "trigger.manual");
  if (triggerNodes.length !== 1) {
    errors.push({ code: "singleTrigger" });
  }

  if (!nodes.some((node) => EXECUTABLE_NODE_TYPES.has(node.type))) {
    errors.push({ code: "needsAction" });
  }

  for (const node of nodes) {
    if (node.type === "terminal.command" && !getConfigString(node, "command", "").trim()) {
      errors.push({ code: "commandRequired", values: { name: node.name }, nodeId: node.id });
    }

    if (
      node.type === "repository.select"
      && getConfigString(node, "mode", "all") === "manual"
      && getConfigStringArray(node, "projectIds").length === 0
    ) {
      errors.push({ code: "repositorySelectionRequired", values: { name: node.name }, nodeId: node.id });
    }
  }

  const inputConfigurationIssue = getWorkflowInputConfigurationIssue(nodes);
  if (inputConfigurationIssue) {
    errors.push(inputConfigurationIssue);
  }

  const incomingEdges = new Map<string, number>();
  const outgoingEdges = new Map<string, string>();

  for (const edge of edges) {
    if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) {
      errors.push({ code: "edgeMissingNode" });
      continue;
    }

    if (edge.source === edge.target) {
      errors.push({
        code: "selfConnection",
        values: { name: nodesById.get(edge.source)?.name ?? edge.source },
        nodeId: edge.source
      });
      continue;
    }

    if (outgoingEdges.has(edge.source)) {
      errors.push({
        code: "multipleOutputs",
        values: { name: nodesById.get(edge.source)?.name ?? edge.source },
        nodeId: edge.source
      });
    } else {
      outgoingEdges.set(edge.source, edge.target);
    }

    const incomingCount = (incomingEdges.get(edge.target) ?? 0) + 1;
    incomingEdges.set(edge.target, incomingCount);
    if (incomingCount > 1) {
      errors.push({
        code: "multipleInputs",
        values: { name: nodesById.get(edge.target)?.name ?? edge.target },
        nodeId: edge.target
      });
    }
  }

  const triggerNode = triggerNodes[0];
  if (triggerNode && (incomingEdges.get(triggerNode.id) ?? 0) > 0) {
    errors.push({ code: "triggerMustBeFirst", nodeId: triggerNode.id });
  }

  for (const node of nodes) {
    if (node.type === "output.summary" && outgoingEdges.has(node.id)) {
      errors.push({ code: "summaryMustBeLast", values: { name: node.name }, nodeId: node.id });
    }
  }

  const orderedNodeIds: string[] = [];
  const visitedNodeIds = new Set<string>();
  let currentNode: WorkflowNode | undefined = triggerNode;

  while (currentNode && !visitedNodeIds.has(currentNode.id)) {
    orderedNodeIds.push(currentNode.id);
    visitedNodeIds.add(currentNode.id);
    currentNode = nodesById.get(outgoingEdges.get(currentNode.id) ?? "");
  }

  if (currentNode) {
    errors.push({ code: "cycle" });
  }

  const disconnectedNodes = nodes.filter((node) => !visitedNodeIds.has(node.id));
  if (triggerNode && disconnectedNodes.length > 0) {
    errors.push({ ...getDisconnectedNodesIssue(disconnectedNodes), nodeId: disconnectedNodes[0]?.id });
  }

  if (!nodes.some((node) => node.type === "repository.select")) {
    warnings.push({ code: "noRepositorySelectWarning" });
  }

  if (!nodes.some((node) => node.type === "output.summary")) {
    warnings.push({ code: "noSummaryWarning" });
  }

  return {
    errors: deduplicateIssues(errors),
    warnings: deduplicateIssues(warnings),
    orderedNodeIds,
    isRunnable: errors.length === 0
  };
}

function getDisconnectedNodesIssue(nodes: WorkflowNode[]): WorkflowIssue {
  const names = nodes.slice(0, 3).map((node) => `“${node.name}”`).join(", ");
  const remainingCount = nodes.length - 3;

  return remainingCount > 0
    ? { code: "disconnectedNodesMore", values: { names, remaining: remainingCount } }
    : { code: "disconnectedNodes", values: { names } };
}

function deduplicateIssues(issues: WorkflowValidationIssue[]): WorkflowValidationIssue[] {
  const identities = new Set<string>();
  return issues.filter((issue) => {
    const identity = getWorkflowIssueIdentity(issue);
    if (identities.has(identity)) {
      return false;
    }
    identities.add(identity);
    return true;
  });
}
