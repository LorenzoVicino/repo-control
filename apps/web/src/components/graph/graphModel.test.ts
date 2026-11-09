import { describe, expect, it } from "vitest";
import type { WorkspaceGraph } from "../../types/graph";
import { buildGraph, findRepositories, relationsFor, type GraphColors } from "./graphModel";

const colors: GraphColors = {
  repository: { default: "#999999", api: "#0000ff", library: "#00ff00" },
  label: "#555555",
  edges: { depends_on: "#ffaa00", references: "#00aaff", similar: "#ff00aa", labelled: "#333333" }
};

const data: WorkspaceGraph = {
  nodes: [
    { id: "a", type: "repository", name: "atlas-api", relativePath: "atlas-api", kind: "api", labels: ["api", "typescript"] },
    { id: "s", type: "repository", name: "shared-utils", relativePath: "libs/shared-utils", kind: "library", labels: ["library"] },
    { id: "w", type: "repository", name: "atlas-web", relativePath: "atlas-web", kind: null, labels: [] },
    { id: "label:language:typescript", type: "label", name: "typescript", labelKind: "language", count: 1 }
  ],
  edges: [
    { source: "a", target: "s", type: "depends_on", weight: 3, evidence: ["depends on @atlas/shared-utils"] },
    { source: "w", target: "s", type: "depends_on", weight: 3, evidence: ["depends on @atlas/shared-utils"] },
    { source: "w", target: "a", type: "references", weight: 1, evidence: ["README.md mentions atlas-api"] },
    { source: "a", target: "w", type: "similar", weight: 0.8, evidence: ["summaries 80% similar"] },
    { source: "a", target: "label:language:typescript", type: "labelled", weight: 1, evidence: ["91% of source files"] },
    { source: "a", target: "missing", type: "references", weight: 1, evidence: ["ignored"] }
  ]
};

describe("graph model", () => {
  it("builds a laid-out graph with sizes and colours by role", () => {
    const graph = buildGraph(data, colors, { iterations: 30 });
    expect(graph.order).toBe(4);
    // The edge to an unknown node is skipped.
    expect(graph.size).toBe(5);
    expect(graph.getNodeAttribute("a", "color")).toBe("#0000ff");
    // A repository without a kind gets the default colour.
    expect(graph.getNodeAttribute("w", "color")).toBe("#999999");
    expect(graph.getNodeAttribute("label:language:typescript", "nodeType")).toBe("label");
    // Size grows with relations: atlas-web has three, shared-utils two.
    expect(graph.getNodeAttribute("w", "size")).toBeGreaterThan(graph.getNodeAttribute("s", "size"));
    expect(graph.getNodeAttribute("s", "size")).toBeGreaterThan(graph.getNodeAttribute("label:language:typescript", "size"));
    const dependency = graph.edges("a", "s").map((edge) => graph.getEdgeAttributes(edge))[0];
    expect(dependency).toMatchObject({ edgeType: "depends_on", color: "#ffaa00", evidence: ["depends on @atlas/shared-utils"] });
    graph.forEachNode((_node, attributes) => {
      expect(Number.isFinite(attributes.x) && Number.isFinite(attributes.y)).toBe(true);
    });
  });

  it("groups a node's relations for the side panel", () => {
    const shared = relationsFor(data, "s");
    expect(shared?.usedBy.map((relation) => relation.name)).toEqual(["atlas-api", "atlas-web"]);
    expect(shared?.dependsOn).toEqual([]);
    const api = relationsFor(data, "a");
    expect(api?.mentionedBy).toEqual([{ id: "w", name: "atlas-web", evidence: ["README.md mentions atlas-api"] }]);
    expect(api?.similar.map((relation) => relation.name)).toEqual(["atlas-web"]);
    expect(api?.labelled.map((relation) => relation.name)).toEqual(["typescript"]);
    expect(relationsFor(data, "label:language:typescript")?.labelled.map((relation) => relation.name)).toEqual(["atlas-api"]);
    expect(relationsFor(data, "nope")).toBeNull();
  });

  it("finds repositories by name, prefix matches first, and never label nodes", () => {
    expect(findRepositories(data, "atlas").map((node) => node.name)).toEqual(["atlas-api", "atlas-web"]);
    expect(findRepositories(data, "utils").map((node) => node.name)).toEqual(["shared-utils"]);
    expect(findRepositories(data, "typescript")).toEqual([]);
    expect(findRepositories(data, "  ")).toEqual([]);
  });
});
