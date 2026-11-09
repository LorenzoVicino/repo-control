import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Chunk, ChunkKind } from "./chunk.js";
import { buildTextIndex, type TextIndex } from "./bm25.js";
import { fromBlob, toBlob } from "./embeddings.js";
import type { RepositoryLabel } from "./labels.js";

// The knowledge index lives in one SQLite file in the configuration directory, using the
// SQLite built into Node (node:sqlite). It stores; ranking happens in bm25.ts, because FTS5
// is not compiled into every Node release. Rows are scoped by workspace root, so switching
// workspaces keeps each one's index.

export type StoredRepository = {
  root: string;
  id: string;
  name: string;
  relativePath: string;
  fingerprint: string;
  indexedAt: string;
  labels: RepositoryLabel[];
  summary: string;
};

export type TextHit = {
  rowid: number;
  repositoryId: string;
  path: string;
  kind: ChunkKind;
  snippet: string;
  /** BM25 score: higher is better. */
  score: number;
};

type StoredChunk = { rowid: number; repositoryId: string; path: string; kind: ChunkKind; text: string };

export type StoredVector = { rowid: number; repositoryId: string; vector: Float32Array };

// Version 2 replaced the FTS5 table with a plain one. The index is a cache of the workspace,
// so an older file is simply rebuilt.
const SCHEMA_VERSION = "2";

export function openKnowledgeStore(file: string) {
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 3000; CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);");
  const schema = (db.prepare("SELECT value FROM meta WHERE key = 'schema'").get() as { value?: string } | undefined)?.value;
  if (schema !== SCHEMA_VERSION) {
    db.exec("DROP TABLE IF EXISTS chunks; DROP TABLE IF EXISTS chunk_texts; DROP TABLE IF EXISTS chunk_vectors; DROP TABLE IF EXISTS repositories; DELETE FROM meta;");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS repositories (
      root TEXT NOT NULL,
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      indexed_at TEXT NOT NULL,
      labels TEXT NOT NULL,
      summary TEXT NOT NULL,
      PRIMARY KEY (root, id)
    );
    CREATE TABLE IF NOT EXISTS chunk_texts (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT,
      root TEXT NOT NULL,
      repository_id TEXT NOT NULL,
      path TEXT NOT NULL,
      kind TEXT NOT NULL,
      text TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS chunk_texts_repository ON chunk_texts (root, repository_id);
    CREATE TABLE IF NOT EXISTS chunk_vectors (
      chunk_rowid INTEGER PRIMARY KEY,
      root TEXT NOT NULL,
      repository_id TEXT NOT NULL,
      vector BLOB NOT NULL
    );
    CREATE INDEX IF NOT EXISTS chunk_vectors_repository ON chunk_vectors (root, repository_id);
  `);
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema', ?)").run(SCHEMA_VERSION);

  const statements = {
    getRepository: db.prepare("SELECT * FROM repositories WHERE root = ? AND id = ?"),
    listRepositories: db.prepare("SELECT * FROM repositories WHERE root = ? ORDER BY name"),
    upsertRepository: db.prepare(`INSERT INTO repositories (root, id, name, relative_path, fingerprint, indexed_at, labels, summary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (root, id) DO UPDATE SET name = excluded.name, relative_path = excluded.relative_path, fingerprint = excluded.fingerprint,
        indexed_at = excluded.indexed_at, labels = excluded.labels, summary = excluded.summary`),
    deleteRepository: db.prepare("DELETE FROM repositories WHERE root = ? AND id = ?"),
    deleteChunks: db.prepare("DELETE FROM chunk_texts WHERE root = ? AND repository_id = ?"),
    deleteVectors: db.prepare("DELETE FROM chunk_vectors WHERE root = ? AND repository_id = ?"),
    insertChunk: db.prepare("INSERT INTO chunk_texts (text, path, kind, repository_id, root) VALUES (?, ?, ?, ?, ?)"),
    insertVector: db.prepare("INSERT INTO chunk_vectors (chunk_rowid, root, repository_id, vector) VALUES (?, ?, ?, ?)"),
    chunksOf: db.prepare("SELECT rowid, repository_id, path, kind, text FROM chunk_texts WHERE root = ?"),
    chunkText: db.prepare("SELECT rowid, repository_id, path, kind, text FROM chunk_texts WHERE rowid = ?"),
    vectors: db.prepare("SELECT chunk_rowid, repository_id, vector FROM chunk_vectors WHERE root = ?"),
    getMeta: db.prepare("SELECT value FROM meta WHERE key = ?"),
    setMeta: db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value"),
    clearVectors: db.prepare("DELETE FROM chunk_vectors"),
    forgetFingerprints: db.prepare("UPDATE repositories SET fingerprint = ''")
  };

  const vectorCache = new Map<string, StoredVector[]>();
  const textCache = new Map<string, { chunks: Map<number, StoredChunk>; index: TextIndex }>();
  const invalidate = (root: string) => {
    vectorCache.delete(root);
    textCache.delete(root);
  };

  function textIndex(root: string) {
    const cached = textCache.get(root);
    if (cached) return cached;
    const chunks = new Map(
      (statements.chunksOf.all(root) as Array<Record<string, unknown>>).map((row) => [
        Number(row.rowid),
        { rowid: Number(row.rowid), repositoryId: String(row.repository_id), path: String(row.path), kind: String(row.kind) as ChunkKind, text: String(row.text) }
      ])
    );
    const built = { chunks, index: buildTextIndex([...chunks.values()].map((chunk) => ({ id: chunk.rowid, text: chunk.text }))) };
    textCache.set(root, built);
    return built;
  }

  function rowToRepository(row: Record<string, unknown>): StoredRepository {
    return {
      root: String(row.root),
      id: String(row.id),
      name: String(row.name),
      relativePath: String(row.relative_path),
      fingerprint: String(row.fingerprint),
      indexedAt: String(row.indexed_at),
      labels: JSON.parse(String(row.labels)) as RepositoryLabel[],
      summary: String(row.summary)
    };
  }

  function transaction<T>(work: () => T): T {
    db.exec("BEGIN");
    try {
      const result = work();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  return {
    getRepository(root: string, id: string): StoredRepository | null {
      const row = statements.getRepository.get(root, id) as Record<string, unknown> | undefined;
      return row ? rowToRepository(row) : null;
    },

    listRepositories(root: string): StoredRepository[] {
      return (statements.listRepositories.all(root) as Array<Record<string, unknown>>).map(rowToRepository);
    },

    /** Replaces a repository's record, chunks and vectors in one transaction. */
    saveRepository(repository: StoredRepository, chunks: readonly Chunk[], vectors: readonly Float32Array[] | null) {
      transaction(() => {
        statements.deleteChunks.run(repository.root, repository.id);
        statements.deleteVectors.run(repository.root, repository.id);
        statements.upsertRepository.run(
          repository.root,
          repository.id,
          repository.name,
          repository.relativePath,
          repository.fingerprint,
          repository.indexedAt,
          JSON.stringify(repository.labels),
          repository.summary
        );
        chunks.forEach((chunk, index) => {
          const { lastInsertRowid } = statements.insertChunk.run(chunk.text, chunk.path, chunk.kind, repository.id, repository.root);
          const vector = vectors?.[index];
          if (vector) statements.insertVector.run(Number(lastInsertRowid), repository.root, repository.id, toBlob(vector));
        });
      });
      invalidate(repository.root);
    },

    /** Drops repositories that are no longer in the workspace. Returns how many were removed. */
    prune(root: string, keepIds: ReadonlySet<string>): number {
      const stale = this.listRepositories(root).filter((repository) => !keepIds.has(repository.id));
      if (!stale.length) return 0;
      transaction(() => {
        for (const repository of stale) {
          statements.deleteChunks.run(root, repository.id);
          statements.deleteVectors.run(root, repository.id);
          statements.deleteRepository.run(root, repository.id);
        }
      });
      invalidate(root);
      return stale.length;
    },

    searchText(root: string, query: string, limit: number): TextHit[] {
      const { chunks, index } = textIndex(root);
      return index.search(query, limit).flatMap((match) => {
        const chunk = chunks.get(match.id);
        return chunk ? [{ rowid: chunk.rowid, repositoryId: chunk.repositoryId, path: chunk.path, kind: chunk.kind, snippet: match.snippet, score: match.score }] : [];
      });
    },

    chunk(rowid: number): { rowid: number; repositoryId: string; path: string; kind: ChunkKind; text: string } | null {
      const row = statements.chunkText.get(rowid) as Record<string, unknown> | undefined;
      return row ? { rowid: Number(row.rowid), repositoryId: String(row.repository_id), path: String(row.path), kind: String(row.kind) as ChunkKind, text: String(row.text) } : null;
    },

    vectors(root: string): StoredVector[] {
      const cached = vectorCache.get(root);
      if (cached) return cached;
      const loaded = (statements.vectors.all(root) as Array<Record<string, unknown>>).map((row) => ({
        rowid: Number(row.chunk_rowid),
        repositoryId: String(row.repository_id),
        vector: fromBlob(row.vector as Uint8Array)
      }));
      vectorCache.set(root, loaded);
      return loaded;
    },

    /**
     * Records which embedding model produced the stored vectors. When it changes, the old
     * vectors are useless: they are dropped and every repository is marked for re-indexing.
     */
    useEmbeddingModel(modelId: string | null): boolean {
      const current = (statements.getMeta.get("embedding_model") as { value?: string } | undefined)?.value ?? "";
      const next = modelId ?? "";
      if (current === next) return false;
      transaction(() => {
        statements.clearVectors.run();
        statements.forgetFingerprints.run();
        statements.setMeta.run("embedding_model", next);
      });
      vectorCache.clear();
      textCache.clear();
      return true;
    },

    close() {
      db.close();
    }
  };
}

export type KnowledgeStore = ReturnType<typeof openKnowledgeStore>;
