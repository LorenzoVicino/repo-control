import type { ChunkKind } from "./chunk.js";
import { cosine, type EmbeddingProvider } from "./embeddings.js";
import type { KnowledgeStore, StoredRepository } from "./store.js";

// Hybrid retrieval. Full-text search (BM25 over FTS5) finds exact words, names and
// identifiers; vector search, when an embedding provider is present, finds the same meaning
// in other words or another language. The two rankings are merged with reciprocal rank
// fusion, which needs no score calibration between them, and chunk hits are rolled up into
// repositories, with a boost when the query names a repository or one of its labels.

export type SearchMatch = { path: string; kind: ChunkKind; snippet: string };
export type RepositoryHit = {
  repository: StoredRepository;
  score: number;
  matches: SearchMatch[];
  /** Which retrievers contributed: "text", "semantic", "label" or "name". */
  via: string[];
};

const RRF_K = 60;
const CANDIDATES = 40;

/** Turns free text into an FTS5 query: each word as a prefix term, OR-ed, quotes escaped. */
export function toFtsQuery(query: string): string {
  const words = (query.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? []).filter((word) => word.length > 1).slice(0, 12);
  return [...new Set(words)].map((word) => `"${word.replace(/"/g, '""')}"*`).join(" OR ");
}

function snippetOf(text: string, length = 220): string {
  const body = text.includes(" · ") ? text.slice(text.indexOf(" · ") + 3) : text;
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}

export async function searchKnowledge(
  store: KnowledgeStore,
  root: string,
  query: string,
  options: { provider: EmbeddingProvider | null; limit?: number }
): Promise<RepositoryHit[]> {
  const limit = options.limit ?? 8;
  const repositories = new Map(store.listRepositories(root).map((repository) => [repository.id, repository]));
  const chunkScores = new Map<number, { repositoryId: string; score: number; match: SearchMatch; via: Set<string> }>();

  const textHits = store.searchText(root, toFtsQuery(query), CANDIDATES);
  textHits.forEach((hit, rank) => {
    chunkScores.set(hit.rowid, {
      repositoryId: hit.repositoryId,
      score: 1 / (RRF_K + rank + 1),
      match: { path: hit.path, kind: hit.kind, snippet: hit.snippet.replace(/^[^·]*· /, "") },
      via: new Set(["text"])
    });
  });

  if (options.provider && query.trim()) {
    const [queryVector] = await options.provider.embed([query]);
    const ranked = store
      .vectors(root)
      .map((stored) => ({ stored, similarity: cosine(queryVector, stored.vector) }))
      .filter((candidate) => candidate.similarity > 0.2)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, CANDIDATES);
    ranked.forEach(({ stored }, rank) => {
      const existing = chunkScores.get(stored.rowid);
      const contribution = 1 / (RRF_K + rank + 1);
      if (existing) {
        existing.score += contribution;
        existing.via.add("semantic");
        return;
      }
      const chunk = store.chunk(stored.rowid);
      if (!chunk) return;
      chunkScores.set(stored.rowid, {
        repositoryId: stored.repositoryId,
        score: contribution,
        match: { path: chunk.path, kind: chunk.kind, snippet: snippetOf(chunk.text) },
        via: new Set(["semantic"])
      });
    });
  }

  // Roll chunks up into repositories: the best three chunks count, so one repository with a
  // long README cannot win on volume alone.
  const byRepository = new Map<string, Array<{ score: number; match: SearchMatch; via: Set<string> }>>();
  for (const entry of chunkScores.values()) {
    const list = byRepository.get(entry.repositoryId) ?? [];
    list.push(entry);
    byRepository.set(entry.repositoryId, list);
  }

  const words = new Set((query.toLowerCase().match(/[\p{L}\p{N}_.#+-]+/gu) ?? []).filter((word) => word.length > 1));
  const lowered = query.toLowerCase();
  const hits: RepositoryHit[] = [];

  for (const repository of repositories.values()) {
    const entries = (byRepository.get(repository.id) ?? []).sort((a, b) => b.score - a.score);
    const via = new Set(entries.flatMap((entry) => [...entry.via]));
    let score = entries.slice(0, 3).reduce((sum, entry, index) => sum + entry.score / (index + 1), 0);

    // A query that names a label ("react", "docker", "api") or the repository itself is the
    // strongest possible signal.
    const labelHit = repository.labels.some((label) => words.has(label.id) || (label.id.includes(" ") && lowered.includes(label.id)));
    if (labelHit) {
      score += 2 / RRF_K;
      via.add("label");
    }
    if (lowered.includes(repository.name.toLowerCase())) {
      score += 3 / RRF_K;
      via.add("name");
    }
    if (score > 0) hits.push({ repository, score, matches: entries.slice(0, 3).map((entry) => entry.match), via: [...via] });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
