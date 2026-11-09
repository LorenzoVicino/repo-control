import Graph from "graphology";
import circular from "graphology-layout/circular";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type { GraphEdge, GraphEdgeType, GraphNode, WorkspaceGraph } from "../../types/graph";

// Turns the server's workspace graph into a laid-out graphology graph for sigma, and answers
// "what is related to this node" for the side panel. Pure apart from the layout's own maths,
// so it is tested without a browser.

export type GraphColors = {
  repository: Record<string, string> & { default: string };
  label: string;
  edges: Record<GraphEdgeType, string>;
};

export type NodeAttributes = {
  label: string;
  x: number;
  y: number;
  size: number;
  color: string;
  nodeType: GraphNode["type"];
  /** For repositories, the kind label; for label nodes, the label kind. */
  group: string | null;
};

export type EdgeAttributes = { size: number; color: string; edgeType: GraphEdgeType; evidence: string[] };

export function buildGraph(data: WorkspaceGraph, colors: GraphColors, options: { iterations?: number } = {}): Graph<NodeAttributes, EdgeAttributes> {
  const graph = new Graph<NodeAttributes, EdgeAttributes>({ multi: true, type: "directed" });
  const relationDegree = new Map<string, number>();
  for (const edge of data.edges) {
    if (edge.type === "labelled") continue;
    relationDegree.set(edge.source, (relationDegree.get(edge.source) ?? 0) + 1);
    relationDegree.set(edge.target, (relationDegree.get(edge.target) ?? 0) + 1);
  }

  for (const node of data.nodes) {
    if (node.type === "repository") {
      graph.addNode(node.id, {
        label: node.name,
        x: 0,
        y: 0,
        size: 6 + 2 * Math.sqrt(relationDegree.get(node.id) ?? 0),
        color: colors.repository[node.kind ?? "default"] ?? colors.repository.default,
        nodeType: "repository",
        group: node.kind
      });
    } else {
      graph.addNode(node.id, { label: node.name, x: 0, y: 0, size: 2.5 + Math.sqrt(node.count), color: colors.label, nodeType: "label", group: node.labelKind });
    }
  }
  for (const edge of data.edges) {
    if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
    graph.addEdge(edge.source, edge.target, {
      size: edge.type === "labelled" ? 0.6 : edge.type === "depends_on" ? 2.4 : 1.4,
      color: colors.edges[edge.type],
      edgeType: edge.type,
      evidence: edge.evidence
    });
  }

  circular.assign(graph, { scale: 100 });
  if (graph.order > 1) {
    const settings = forceAtlas2.inferSettings(graph);
    forceAtlas2.assign(graph, {
      iterations: options.iterations ?? 260,
      // Relations pull harder than shared labels, so dependent repositories sit together.
      getEdgeWeight: (_edge, attributes) => (attributes.edgeType === "labelled" ? 0.35 : 2),
      settings: { ...settings, gravity: 1.2, scalingRatio: 8, barnesHutOptimize: graph.order > 300 }
    });
  }
  return graph;
}

export type Relation = { id: string; name: string; evidence: string[] };

export type NodeRelations = {
  node: GraphNode;
  dependsOn: Relation[];
  usedBy: Relation[];
  mentions: Relation[];
  mentionedBy: Relation[];
  similar: Relation[];
  /** For a repository, its labels; for a label, the repositories carrying it. */
  labelled: Relation[];
};

export function relationsFor(data: WorkspaceGraph, id: string): NodeRelations | null {
  const nodes = new Map(data.nodes.map((node) => [node.id, node]));
  const node = nodes.get(id);
  if (!node) return null;
  const collect = (type: GraphEdgeType, direction: "out" | "in" | "both"): Relation[] =>
    data.edges
      .filter((edge: GraphEdge) => edge.type === type && ((direction !== "in" && edge.source === id) || (direction !== "out" && edge.target === id)))
      .map((edge) => {
        const otherId = edge.source === id ? edge.target : edge.source;
        return { id: otherId, name: nodes.get(otherId)?.name ?? otherId, evidence: edge.evidence };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

  return {
    node,
    dependsOn: collect("depends_on", "out"),
    usedBy: collect("depends_on", "in"),
    mentions: collect("references", "out"),
    mentionedBy: collect("references", "in"),
    similar: collect("similar", "both"),
    labelled: collect("labelled", "both")
  };
}

/** Repository ids whose name matches a free-text filter, best match first. */
export function findRepositories(data: WorkspaceGraph, query: string): Array<Extract<GraphNode, { type: "repository" }>> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return data.nodes
    .filter((node): node is Extract<GraphNode, { type: "repository" }> => node.type === "repository" && node.name.toLowerCase().includes(needle))
    .sort((a, b) => Number(!a.name.toLowerCase().startsWith(needle)) - Number(!b.name.toLowerCase().startsWith(needle)) || a.name.localeCompare(b.name));
}
