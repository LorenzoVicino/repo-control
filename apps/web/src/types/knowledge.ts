// Mirrors apps/server/src/services/knowledge: labels, index status and search hits.

export type LabelKind = "language" | "framework" | "kind" | "tooling" | "topic";

export type RepositoryLabel = { id: string; kind: LabelKind; evidence: string; confidence: number };

export type KnowledgeRepository = {
  id: string;
  name: string;
  relativePath: string;
  labels: RepositoryLabel[];
  summary: string;
  indexedAt: string;
};

export type KnowledgeStatus = {
  state: "idle" | "indexing";
  root: string;
  indexed: number;
  total: number;
  progress: { done: number; total: number } | null;
  lastRun: { startedAt: string; finishedAt: string; updated: number; skipped: number; removed: number; failed: string[] } | null;
  semantic: {
    enabled: boolean;
    model: string | null;
    installable: boolean;
    install: { state: "idle" | "installing" | "failed"; message: string | null };
  };
};

export type KnowledgeMatch = { path: string; kind: "summary" | "readme" | "doc" | "manifest" | "commits"; snippet: string };

export type KnowledgeHit = {
  id: string;
  name: string;
  relativePath: string;
  labels: RepositoryLabel[];
  score: number;
  via: Array<"text" | "semantic" | "label" | "name">;
  matches: KnowledgeMatch[];
};
