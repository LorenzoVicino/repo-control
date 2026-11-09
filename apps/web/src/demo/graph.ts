import type { WorkspaceGraph } from "../types/graph";
import type { ProjectSummary } from "../types/projects";
import { demoKnowledgeRepositories } from "./knowledge";

// The demo workspace as a graph: its labels from the demo knowledge index, plus the
// dependencies and mentions a real index would find in these fictional repositories.
const RELATIONS: Array<{ source: string; target: string; type: "depends_on" | "references"; evidence: string }> = [
  { source: "atlas-web", target: "shared-utils", type: "depends_on", evidence: "depends on @atlas/shared-utils" },
  { source: "atlas-api", target: "shared-utils", type: "depends_on", evidence: "depends on @atlas/shared-utils" },
  { source: "mobile-client", target: "shared-utils", type: "depends_on", evidence: "depends on @atlas/shared-utils" },
  { source: "atlas-web", target: "design-system", type: "depends_on", evidence: "depends on @atlas/design-system" },
  { source: "mobile-client", target: "design-system", type: "depends_on", evidence: "depends on @atlas/design-system" },
  { source: "atlas-web", target: "atlas-api", type: "references", evidence: "README.md mentions atlas-api" },
  { source: "atlas-api", target: "billing-worker", type: "references", evidence: "README.md mentions billing-worker" },
  { source: "documentation", target: "atlas-api", type: "references", evidence: "docs/architecture.md mentions atlas-api" },
  { source: "documentation", target: "billing-worker", type: "references", evidence: "docs/runbooks.md mentions billing-worker" }
];

export function demoWorkspaceGraph(projects: readonly ProjectSummary[]): WorkspaceGraph {
  const repositories = demoKnowledgeRepositories(projects);
  const byName = new Map(repositories.map((repository) => [repository.name, repository.id]));
  const graph: WorkspaceGraph = { nodes: [], edges: [] };
  const labelCounts = new Map<string, { kind: "kind" | "language" | "framework" | "topic"; name: string; count: number }>();

  for (const repository of repositories) {
    graph.nodes.push({ id: repository.id, type: "repository", name: repository.name, relativePath: repository.relativePath, kind: repository.labels.find((label) => label.kind === "kind")?.id ?? null, labels: repository.labels.map((label) => label.id) });
    for (const label of repository.labels) {
      if (label.kind === "tooling") continue;
      const id = `label:${label.kind}:${label.id}`;
      const entry = labelCounts.get(id) ?? { kind: label.kind, name: label.id, count: 0 };
      entry.count += 1;
      labelCounts.set(id, entry);
      graph.edges.push({ source: repository.id, target: id, type: "labelled", weight: 1, evidence: [label.evidence] });
    }
  }
  for (const [id, label] of labelCounts) graph.nodes.push({ id, type: "label", name: label.name, labelKind: label.kind, count: label.count });
  for (const relation of RELATIONS) {
    const source = byName.get(relation.source);
    const target = byName.get(relation.target);
    if (source && target) graph.edges.push({ source, target, type: relation.type, weight: relation.type === "depends_on" ? 3 : 1, evidence: [relation.evidence] });
  }
  return graph;
}
