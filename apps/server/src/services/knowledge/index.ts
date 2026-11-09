import path from "node:path";
import { createHash } from "node:crypto";
import type { ProjectSummary } from "../../gitScanner.js";
import type { CommandRunner } from "../../lib/commandRunner.js";
import { chunkRepository, type Chunk } from "./chunk.js";
import { collectRepositoryDocuments, type RepositoryDocuments } from "./collect.js";
import { cosine, type EmbeddingProvider } from "./embeddings.js";
import { deriveLabels, TOPICS, type RepositoryLabel } from "./labels.js";
import { buildWorkspaceGraph, relationsOf, type RepositoryRelations, type WorkspaceGraph } from "./graph.js";
import { searchKnowledge, type RepositoryHit } from "./search.js";
import type { KnowledgeStore, StoredRepository } from "./store.js";

export type { RepositoryHit } from "./search.js";
export type { RepositoryLabel } from "./labels.js";
export type { GraphEdge, GraphNode, RepositoryRelations, WorkspaceGraph } from "./graph.js";

export type KnowledgeStatus = {
  state: "idle" | "indexing";
  root: string;
  indexed: number;
  total: number;
  /** Repositories processed in the current or last run. */
  progress: { done: number; total: number } | null;
  lastRun: { startedAt: string; finishedAt: string; updated: number; skipped: number; removed: number; failed: string[] } | null;
  semantic: {
    enabled: boolean;
    model: string | null;
    /** Whether this installation can download the semantic search runtime on request. */
    installable: boolean;
    install: { state: "idle" | "installing" | "failed"; message: string | null };
  };
};

type KnowledgeDependencies = {
  store: KnowledgeStore;
  getActiveRootPath: () => string;
  scan: (rootPath: string) => Promise<ProjectSummary[]>;
  runProjectCommand: CommandRunner;
  /** Resolved lazily, once; null means full-text only. */
  loadProvider?: () => Promise<EmbeddingProvider | null>;
  /** Downloads the embedding runtime, for the opt-in "enable semantic search" action. */
  installProvider?: () => Promise<{ ok: boolean; output: string }>;
  now?: () => Date;
};

const CONCURRENCY = 4;
const TOPIC_THRESHOLD = 0.32;

/** Changes whenever anything the index reads changes, so unchanged repositories are skipped. */
export function fingerprint(docs: RepositoryDocuments): string {
  const hash = createHash("sha256");
  hash.update(docs.head);
  hash.update(String(docs.fileCount));
  hash.update(JSON.stringify(docs.manifests));
  hash.update(docs.readme?.text ?? "");
  for (const doc of docs.docs) hash.update(doc.text);
  hash.update(docs.composeServices.join(","));
  return hash.digest("hex").slice(0, 32);
}

export function createKnowledgeIndex({
  store,
  getActiveRootPath,
  scan,
  runProjectCommand,
  loadProvider = async () => null,
  installProvider,
  now = () => new Date()
}: KnowledgeDependencies) {
  let providerPromise: Promise<EmbeddingProvider | null> | null = null;
  let provider: EmbeddingProvider | null = null;
  let running: Promise<KnowledgeStatus["lastRun"]> | null = null;
  let progress: KnowledgeStatus["progress"] = null;
  let lastRun: KnowledgeStatus["lastRun"] = null;
  let topicVectors: Array<{ id: string; description: string; vector: Float32Array }> | null = null;
  let install: KnowledgeStatus["semantic"]["install"] = { state: "idle", message: null };
  let installing: Promise<void> | null = null;

  function getProvider(): Promise<EmbeddingProvider | null> {
    providerPromise ??= loadProvider()
      .catch(() => null)
      .then((loaded) => {
        provider = loaded;
        store.useEmbeddingModel(loaded?.id ?? null);
        return loaded;
      });
    return providerPromise;
  }

  async function topicLabels(summaryVector: Float32Array, active: EmbeddingProvider): Promise<RepositoryLabel[]> {
    if (!topicVectors) {
      const vectors = await active.embed(TOPICS.map((topic) => topic.description));
      topicVectors = TOPICS.map((topic, index) => ({ ...topic, vector: vectors[index] }));
    }
    return topicVectors
      .map((topic) => ({ topic, similarity: cosine(summaryVector, topic.vector) }))
      .filter(({ similarity }) => similarity >= TOPIC_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 2)
      .map(({ topic, similarity }) => ({ id: topic.id, kind: "topic" as const, evidence: `similar to "${topic.description}"`, confidence: Math.round(similarity * 100) / 100 }));
  }

  async function indexOne(root: string, project: ProjectSummary): Promise<"updated" | "skipped"> {
    const docs = await collectRepositoryDocuments(project.path, runProjectCommand);
    const print = fingerprint(docs);
    const existing = store.getRepository(root, project.id);
    if (existing && existing.fingerprint === print) return "skipped";

    let labels = deriveLabels(docs);
    let vectors: Float32Array[] | null = null;
    const active = await getProvider();
    if (active) {
      // Topics come from the summary's meaning; they then join the labels and the summary
      // itself, so full-text search finds them too.
      const [summaryVector] = await active.embed([chunkRepository(project.name, docs, labels)[0].text]);
      labels = [...labels, ...(await topicLabels(summaryVector, active))];
    }
    const chunks: Chunk[] = chunkRepository(project.name, docs, labels);
    if (active) vectors = await active.embed(chunks.map((chunk) => chunk.text));

    const facts = {
      packages: [...new Set(docs.manifests.map((manifest) => manifest.name).filter((name): name is string => Boolean(name)))],
      dependencies: [...new Set(docs.manifests.flatMap((manifest) => manifest.dependencies))]
    };
    const record: StoredRepository = {
      root,
      id: project.id,
      name: project.name,
      relativePath: (path.relative(root, project.path) || ".").replace(/\\/g, "/"),
      fingerprint: print,
      indexedAt: now().toISOString(),
      labels,
      summary: chunks[0].text,
      facts
    };
    store.saveRepository(record, chunks, vectors);
    return "updated";
  }

  async function run(): Promise<KnowledgeStatus["lastRun"]> {
    const root = getActiveRootPath();
    const startedAt = now().toISOString();
    await getProvider();
    const projects = await scan(root);
    progress = { done: 0, total: projects.length };
    let updated = 0;
    let skipped = 0;
    const failed: string[] = [];

    const queue = [...projects];
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        for (let project = queue.shift(); project; project = queue.shift()) {
          try {
            if ((await indexOne(root, project)) === "updated") updated += 1;
            else skipped += 1;
          } catch {
            failed.push(project.name);
          }
          if (progress) progress.done += 1;
        }
      })
    );

    const removed = store.prune(root, new Set(projects.map((project) => project.id)));
    return { startedAt, finishedAt: now().toISOString(), updated, skipped, removed, failed };
  }

  return {
    /** Starts indexing unless a run is already going; resolves when that run finishes. */
    reindex(): Promise<KnowledgeStatus["lastRun"]> {
      running ??= run()
        .then((result) => {
          lastRun = result;
          return result;
        })
        .finally(() => {
          running = null;
          progress = null;
        });
      return running;
    },

    status(): KnowledgeStatus {
      const root = getActiveRootPath();
      return {
        state: running ? "indexing" : "idle",
        root,
        indexed: store.listRepositories(root).length,
        total: progress?.total ?? store.listRepositories(root).length,
        progress,
        lastRun,
        semantic: { enabled: provider !== null, model: provider?.id ?? null, installable: Boolean(installProvider), install }
      };
    },

    /**
     * Installs the embedding runtime, loads it and re-indexes so every repository gets vectors
     * and topic labels. Runs once at a time; the status reports progress and failures.
     */
    enableSemantic(): Promise<void> {
      if (!installProvider) return Promise.reject(new Error("Semantic search cannot be installed from here."));
      installing ??= (async () => {
        install = { state: "installing", message: null };
        try {
          if (!(await getProvider())) {
            const result = await installProvider();
            if (!result.ok) throw new Error(result.output.trim().split("\n").slice(-6).join("\n") || "The install failed.");
            providerPromise = null;
            topicVectors = null;
            if (!(await getProvider())) throw new Error("The runtime was installed but could not be loaded.");
          }
          await this.reindex();
          install = { state: "idle", message: null };
        } catch (error) {
          install = { state: "failed", message: error instanceof Error ? error.message : String(error) };
        } finally {
          installing = null;
        }
      })();
      return installing;
    },

    repositories(): StoredRepository[] {
      return store.listRepositories(getActiveRootPath());
    },

    /** The workspace graph; builds the index first if the workspace was never indexed. */
    async graph(): Promise<WorkspaceGraph> {
      const root = getActiveRootPath();
      if (!store.listRepositories(root).length) await this.reindex();
      const chunks = store.chunks(root);
      const summaries = new Map(chunks.filter((chunk) => chunk.kind === "summary").map((chunk) => [chunk.rowid, chunk.repositoryId]));
      const summaryVectors = new Map<string, Float32Array>();
      for (const stored of store.vectors(root)) {
        const repositoryId = summaries.get(stored.rowid);
        if (repositoryId) summaryVectors.set(repositoryId, stored.vector);
      }
      return buildWorkspaceGraph(store.listRepositories(root), chunks, summaryVectors);
    },

    async relations(repositoryId: string): Promise<RepositoryRelations | null> {
      return relationsOf(await this.graph(), store.listRepositories(getActiveRootPath()), repositoryId);
    },

    async search(query: string, limit = 8): Promise<RepositoryHit[]> {
      const root = getActiveRootPath();
      // The first search of a workspace builds the index rather than answering "nothing found".
      if (!store.listRepositories(root).length) await this.reindex();
      return searchKnowledge(store, root, query, { provider: await getProvider(), limit });
    }
  };
}

export type KnowledgeIndex = ReturnType<typeof createKnowledgeIndex>;
