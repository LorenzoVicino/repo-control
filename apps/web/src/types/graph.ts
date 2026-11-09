import type { LabelKind } from "./knowledge";

// Mirrors apps/server/src/services/knowledge/graph.ts.

export type GraphNode =
  | { id: string; type: "repository"; name: string; relativePath: string; kind: string | null; labels: string[] }
  | { id: string; type: "label"; name: string; labelKind: LabelKind; count: number };

export type GraphEdgeType = "depends_on" | "references" | "similar" | "labelled";

export type GraphEdge = { source: string; target: string; type: GraphEdgeType; weight: number; evidence: string[] };

export type WorkspaceGraph = { nodes: GraphNode[]; edges: GraphEdge[] };
