import { cosine } from "./embeddings.js";
import type { LabelKind } from "./labels.js";
import type { StoredChunk, StoredRepository } from "./store.js";

// The workspace as a graph. Repositories are nodes; edges say how two of them are related
// and why, so the dashboard can draw them and the agent can answer "who depends on X?":
//
// - depends_on: a manifest of A lists a package that B publishes (strongest);
// - references: A's README, docs, manifests or commits name B;
// - similar: their summaries mean nearly the same thing (only with semantic search);
// - labelled: A carries a label (kind, language, framework, topic), drawn as a shared node,
//   which clusters repositories without drawing an edge between every pair.

export type GraphNode =
  | { id: string; type: "repository"; name: string; relativePath: string; kind: string | null; labels: string[] }
  | { id: string; type: "label"; name: string; labelKind: LabelKind; count: number };

export type GraphEdgeType = "depends_on" | "references" | "similar" | "labelled";

export type GraphEdge = {
  source: string;
  target: string;
  type: GraphEdgeType;
  weight: number;
  /** Human-readable reasons, e.g. "package.json depends on @atlas/shared-utils". */
  evidence: string[];
};

export type WorkspaceGraph = { nodes: GraphNode[]; edges: GraphEdge[] };

const LABEL_NODE_KINDS = new Set<LabelKind>(["kind", "language", "framework", "topic"]);
const SIMILARITY_THRESHOLD = 0.62;
const SIMILAR_NEIGHBOURS = 3;
const MAX_EVIDENCE = 3;

const labelNodeId = (kind: LabelKind, id: string) => `label:${kind}:${id}`;
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whether a name is specific enough to count as a mention when it appears in text.
 * "atlas-api" or "repo-control" are; "server", "docs" or "api" are ordinary words.
 */
export function isDistinctiveName(name: string): boolean {
  return name.length >= 4 && (/[-_.]/.test(name) || /[a-z][A-Z]/.test(name));
}

/** Normalises a package name for matching: case, and npm scopes are kept but compared whole. */
const packageKey = (name: string) => name.trim().toLowerCase();

export function buildWorkspaceGraph(
  repositories: readonly StoredRepository[],
  chunks: readonly StoredChunk[],
  summaryVectors: ReadonlyMap<string, Float32Array> = new Map()
): WorkspaceGraph {
  const nodes: GraphNode[] = [];
  const edges = new Map<string, GraphEdge>();
  const addEdge = (source: string, target: string, type: GraphEdgeType, evidence: string, weight = 1) => {
    if (source === target) return;
    // Similarity is symmetric: store it once, in a stable direction.
    const [from, to] = type === "similar" && source > target ? [target, source] : [source, target];
    const key = `${type}:${from}:${to}`;
    const existing = edges.get(key);
    if (existing) {
      existing.weight += weight;
      if (existing.evidence.length < MAX_EVIDENCE && !existing.evidence.includes(evidence)) existing.evidence.push(evidence);
      return;
    }
    edges.set(key, { source: from, target: to, type, weight, evidence: [evidence] });
  };

  // Repository nodes, and label nodes with how many repositories carry each label.
  const labelCounts = new Map<string, { kind: LabelKind; name: string; count: number }>();
  for (const repository of repositories) {
    nodes.push({
      id: repository.id,
      type: "repository",
      name: repository.name,
      relativePath: repository.relativePath,
      kind: repository.labels.find((label) => label.kind === "kind")?.id ?? null,
      labels: repository.labels.map((label) => label.id)
    });
    for (const label of repository.labels) {
      if (!LABEL_NODE_KINDS.has(label.kind)) continue;
      const id = labelNodeId(label.kind, label.id);
      const entry = labelCounts.get(id) ?? { kind: label.kind, name: label.id, count: 0 };
      entry.count += 1;
      labelCounts.set(id, entry);
      addEdge(repository.id, id, "labelled", label.evidence);
    }
  }
  for (const [id, label] of labelCounts) nodes.push({ id, type: "label", name: label.name, labelKind: label.kind, count: label.count });

  // depends_on: what each repository publishes, looked up from every other repository's manifests.
  const publishers = new Map<string, StoredRepository[]>();
  for (const repository of repositories) {
    for (const name of repository.facts.packages) {
      const key = packageKey(name);
      publishers.set(key, [...(publishers.get(key) ?? []), repository]);
    }
  }
  for (const repository of repositories) {
    for (const dependency of repository.facts.dependencies) {
      for (const publisher of publishers.get(packageKey(dependency)) ?? []) {
        addEdge(repository.id, publisher.id, "depends_on", `depends on ${dependency}`, 3);
      }
    }
  }

  // references: distinctive repository names mentioned in another repository's text.
  const mentionable = repositories.filter((repository) => isDistinctiveName(repository.name));
  const patterns = mentionable.map((repository) => ({
    repository,
    // Not inside a longer name or path ("x/atlas-api", "atlas-api.github.io") and not a handle ("@atlas").
    pattern: new RegExp(`(^|[^\\p{L}\\p{N}_./@-])${escapeRegExp(repository.name)}(?![\\p{L}\\p{N}_-]|\\.[\\p{L}\\p{N}])`, "iu")
  }));
  const where = (chunk: StoredChunk): string => chunk.path || (chunk.kind === "commits" ? "commit messages" : chunk.kind);
  for (const chunk of chunks) {
    // Summaries are derived from the README and manifests, which are scanned themselves.
    if (chunk.kind === "summary") continue;
    // Each chunk starts with "<own name> · "; that prefix is not a mention.
    const text = chunk.text.includes(" · ") ? chunk.text.slice(chunk.text.indexOf(" · ") + 3) : chunk.text;
    for (const { repository, pattern } of patterns) {
      if (repository.id !== chunk.repositoryId && pattern.test(text)) addEdge(chunk.repositoryId, repository.id, "references", `${where(chunk)} mentions ${repository.name}`);
    }
  }
  // A dependency already explains the mention; keep the stronger edge only.
  for (const edge of [...edges.values()]) {
    if (edge.type === "references" && edges.has(`depends_on:${edge.source}:${edge.target}`)) edges.delete(`references:${edge.source}:${edge.target}`);
  }

  // similar: each repository's nearest neighbours by summary meaning, above a threshold.
  const vectors = [...summaryVectors.entries()];
  for (const [id, vector] of vectors) {
    vectors
      .filter(([other]) => other !== id)
      .map(([other, otherVector]) => ({ other, similarity: cosine(vector, otherVector) }))
      .filter(({ similarity }) => similarity >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, SIMILAR_NEIGHBOURS)
      .forEach(({ other, similarity }) => {
        const key = id < other ? `similar:${id}:${other}` : `similar:${other}:${id}`;
        if (!edges.has(key)) addEdge(id, other, "similar", `summaries ${Math.round(similarity * 100)}% similar`, similarity);
      });
  }

  return { nodes, edges: [...edges.values()] };
}

export type RepositoryRelations = {
  repository: StoredRepository;
  dependsOn: Array<{ repository: StoredRepository; evidence: string[] }>;
  usedBy: Array<{ repository: StoredRepository; evidence: string[] }>;
  mentions: Array<{ repository: StoredRepository; evidence: string[] }>;
  mentionedBy: Array<{ repository: StoredRepository; evidence: string[] }>;
  similar: Array<{ repository: StoredRepository; evidence: string[] }>;
  /** Repositories sharing the most framework, topic and kind labels. */
  sharesLabels: Array<{ repository: StoredRepository; labels: string[] }>;
};

/** Everything the graph says about one repository, grouped by relation. */
export function relationsOf(graph: WorkspaceGraph, repositories: readonly StoredRepository[], id: string): RepositoryRelations | null {
  const byId = new Map(repositories.map((repository) => [repository.id, repository]));
  const repository = byId.get(id);
  if (!repository) return null;
  const pick = (type: GraphEdgeType, direction: "out" | "in") =>
    graph.edges
      .filter((edge) => edge.type === type && (direction === "out" ? edge.source === id : edge.target === id))
      .map((edge) => ({ repository: byId.get(direction === "out" ? edge.target : edge.source)!, evidence: edge.evidence }))
      .filter((entry) => entry.repository)
      .sort((a, b) => a.repository.name.localeCompare(b.repository.name));

  const ownLabels = new Set(repository.labels.filter((label) => label.kind === "framework" || label.kind === "topic" || label.kind === "kind").map((label) => label.id));
  const sharesLabels = repositories
    .filter((other) => other.id !== id)
    .map((other) => ({ repository: other, labels: other.labels.map((label) => label.id).filter((label) => ownLabels.has(label)) }))
    .filter((entry) => entry.labels.length >= 2)
    .sort((a, b) => b.labels.length - a.labels.length || a.repository.name.localeCompare(b.repository.name))
    .slice(0, 5);

  return {
    repository,
    dependsOn: pick("depends_on", "out"),
    usedBy: pick("depends_on", "in"),
    mentions: pick("references", "out"),
    mentionedBy: pick("references", "in"),
    similar: [...pick("similar", "out"), ...pick("similar", "in")],
    sharesLabels
  };
}
