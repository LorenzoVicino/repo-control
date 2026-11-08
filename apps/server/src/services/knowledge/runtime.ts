import path from "node:path";
import { scanProjects } from "../../gitScanner.js";
import type { CommandRunner } from "../../lib/commandRunner.js";
import { getConfigDirectory } from "../../preferences.js";
import { loadTransformersProvider, resolveTransformers } from "./embeddings.js";
import { createKnowledgeIndex, type KnowledgeIndex } from "./index.js";
import { openKnowledgeStore } from "./store.js";

/**
 * The knowledge index as the server and the MCP command use it: opened on first use (so
 * starting repo-control creates no file), stored in the configuration directory, with
 * semantic search switched on only when transformers.js can be found.
 */
export function createLazyKnowledgeIndex(options: { getActiveRootPath: () => string; runProjectCommand: CommandRunner }): () => KnowledgeIndex {
  let index: KnowledgeIndex | null = null;
  return () => {
    if (index) return index;
    const configDirectory = getConfigDirectory();
    const extensions = path.join(configDirectory, "extensions");
    index = createKnowledgeIndex({
      store: openKnowledgeStore(path.join(configDirectory, "knowledge.sqlite")),
      getActiveRootPath: options.getActiveRootPath,
      scan: (root) => scanProjects(root),
      runProjectCommand: options.runProjectCommand,
      loadProvider: async () =>
        resolveTransformers([extensions])
          ? loadTransformersProvider({ searchFolders: [extensions], cacheDir: path.join(configDirectory, "models"), model: process.env.REPO_CONTROL_EMBEDDING_MODEL?.trim() || undefined })
          : null
    });
    return index;
  };
}
