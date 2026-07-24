import type {
  WorkflowEdge,
  WorkflowNode
} from "../../types/workflows";
import { getConfigString, getConfigStringArray } from "./automationNodeCatalog";
import { getWorkflowInputConfigurationError } from "./workflowInputs";

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

export type WorkflowValidationIssue = {
  message: string;
  nodeId?: string;
};

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
      errors.push({ message: `L'identificativo del nodo “${node.name}” è duplicato.`, nodeId: node.id });
    }
    nodesById.set(node.id, node);
  }

  const triggerNodes = nodes.filter((node) => node.type === "trigger.manual");
  if (triggerNodes.length !== 1) {
    errors.push({ message: "Il workflow deve avere un solo nodo di avvio manuale." });
  }

  if (!nodes.some((node) => EXECUTABLE_NODE_TYPES.has(node.type))) {
    errors.push({ message: "Aggiungi almeno un'azione Git, Docker o terminale." });
  }

  for (const node of nodes) {
    if (node.type === "terminal.command" && !getConfigString(node, "command", "").trim()) {
      errors.push({ message: `Configura il comando nel nodo “${node.name}”.`, nodeId: node.id });
    }

    if (
      node.type === "repository.select"
      && getConfigString(node, "mode", "all") === "manual"
      && getConfigStringArray(node, "projectIds").length === 0
    ) {
      errors.push({ message: `Seleziona almeno un repository nel nodo “${node.name}”.`, nodeId: node.id });
    }
  }

  const inputConfigurationError = getWorkflowInputConfigurationError(nodes);
  if (inputConfigurationError) {
    errors.push({ message: inputConfigurationError });
  }

  const incomingEdges = new Map<string, number>();
  const outgoingEdges = new Map<string, string>();

  for (const edge of edges) {
    if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) {
      errors.push({ message: "Una connessione fa riferimento a un nodo che non esiste più." });
      continue;
    }

    if (edge.source === edge.target) {
      errors.push({
        message: `Il nodo “${nodesById.get(edge.source)?.name ?? edge.source}” non può collegarsi a sé stesso.`,
        nodeId: edge.source
      });
      continue;
    }

    if (outgoingEdges.has(edge.source)) {
      errors.push({
        message: `Il nodo “${nodesById.get(edge.source)?.name ?? edge.source}” ha più di un'uscita.`,
        nodeId: edge.source
      });
    } else {
      outgoingEdges.set(edge.source, edge.target);
    }

    const incomingCount = (incomingEdges.get(edge.target) ?? 0) + 1;
    incomingEdges.set(edge.target, incomingCount);
    if (incomingCount > 1) {
      errors.push({
        message: `Il nodo “${nodesById.get(edge.target)?.name ?? edge.target}” ha più di un ingresso.`,
        nodeId: edge.target
      });
    }
  }

  const triggerNode = triggerNodes[0];
  if (triggerNode && (incomingEdges.get(triggerNode.id) ?? 0) > 0) {
    errors.push({ message: "Il nodo di avvio deve essere il primo del flusso.", nodeId: triggerNode.id });
  }

  for (const node of nodes) {
    if (node.type === "output.summary" && outgoingEdges.has(node.id)) {
      errors.push({ message: `Il riepilogo “${node.name}” deve essere l'ultimo nodo.`, nodeId: node.id });
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
    errors.push({ message: "Il workflow contiene un ciclo." });
  }

  const disconnectedNodes = nodes.filter((node) => !visitedNodeIds.has(node.id));
  if (triggerNode && disconnectedNodes.length > 0) {
    errors.push({
      message: `Collega all'avvio ${formatNodeNames(disconnectedNodes)}.`,
      nodeId: disconnectedNodes[0]?.id
    });
  }

  if (!nodes.some((node) => node.type === "repository.select")) {
    warnings.push({ message: "Senza un nodo di selezione, le azioni verranno applicate a tutti i repository." });
  }

  if (!nodes.some((node) => node.type === "output.summary")) {
    warnings.push({ message: "Aggiungi un riepilogo finale per rendere l'esito più leggibile." });
  }

  return {
    errors: deduplicateIssues(errors),
    warnings: deduplicateIssues(warnings),
    orderedNodeIds,
    isRunnable: errors.length === 0
  };
}

function formatNodeNames(nodes: WorkflowNode[]): string {
  const names = nodes.slice(0, 3).map((node) => `“${node.name}”`).join(", ");
  const remainingCount = nodes.length - 3;
  return remainingCount > 0 ? `${names} e altri ${remainingCount} nodi` : names;
}

function deduplicateIssues(issues: WorkflowValidationIssue[]): WorkflowValidationIssue[] {
  const messages = new Set<string>();
  return issues.filter((issue) => {
    if (messages.has(issue.message)) {
      return false;
    }
    messages.add(issue.message);
    return true;
  });
}
