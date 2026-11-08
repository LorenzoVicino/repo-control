import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Semantic search is optional. Its runtime (transformers.js with ONNX Runtime) is several
// hundred megabytes, so repo-control does not ship it: when it is installed, either next to
// repo-control or in the extensions folder of the configuration directory, the index embeds
// chunks locally and search becomes hybrid. Without it everything still works on full-text
// search and rule-based labels. No text ever leaves the machine either way.

export type EmbeddingProvider = {
  /** Identifies the model; stored with the vectors so a model change triggers re-embedding. */
  id: string;
  dimensions: number;
  /** Returns one L2-normalised vector per input text. */
  embed: (texts: string[]) => Promise<Float32Array[]>;
};

export const DEFAULT_EMBEDDING_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
export const TRANSFORMERS_PACKAGE = "@huggingface/transformers";

type FeatureExtractor = (texts: string[], options: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist: () => number[][] }>;
type TransformersModule = {
  env: { cacheDir?: string; allowRemoteModels?: boolean };
  pipeline: (task: "feature-extraction", model: string, options?: Record<string, unknown>) => Promise<FeatureExtractor>;
};

/** Finds the transformers.js package in the given folders, then next to repo-control. */
export function resolveTransformers(searchFolders: readonly string[]): string | null {
  for (const folder of [...searchFolders, process.cwd()]) {
    try {
      return createRequire(path.join(folder, "noop.js")).resolve(TRANSFORMERS_PACKAGE);
    } catch {
      // Not installed there.
    }
  }
  try {
    return createRequire(import.meta.url).resolve(TRANSFORMERS_PACKAGE);
  } catch {
    return null;
  }
}

export async function loadTransformersProvider(options: { searchFolders: readonly string[]; cacheDir: string; model?: string }): Promise<EmbeddingProvider | null> {
  const resolved = resolveTransformers(options.searchFolders);
  if (!resolved) return null;
  const model = options.model ?? DEFAULT_EMBEDDING_MODEL;
  const transformers = (await import(pathToFileURL(resolved).href)) as TransformersModule;
  transformers.env.cacheDir = options.cacheDir;
  const extractor = await transformers.pipeline("feature-extraction", model, { dtype: "q8" });
  const probe = (await extractor(["dimension probe"], { pooling: "mean", normalize: true })).tolist()[0];

  return {
    id: `transformers:${model}`,
    dimensions: probe.length,
    async embed(texts) {
      const vectors: Float32Array[] = [];
      // Small batches keep memory flat on large workspaces.
      for (let start = 0; start < texts.length; start += 16) {
        const output = await extractor(texts.slice(start, start + 16), { pooling: "mean", normalize: true });
        for (const vector of output.tolist()) vectors.push(Float32Array.from(vector));
      }
      return vectors;
    }
  };
}

/** Dot product of two normalised vectors, i.e. their cosine similarity. */
export function cosine(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) sum += a[index] * b[index];
  return sum;
}

export function toBlob(vector: Float32Array): Uint8Array {
  return new Uint8Array(vector.buffer, vector.byteOffset, vector.byteLength);
}

export function fromBlob(blob: Uint8Array): Float32Array {
  // Copy: the SQLite buffer is not guaranteed to be 4-byte aligned.
  const copy = new Uint8Array(blob.byteLength);
  copy.set(blob);
  return new Float32Array(copy.buffer);
}
