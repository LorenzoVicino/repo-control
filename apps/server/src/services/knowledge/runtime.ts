import { promises as fs } from "node:fs";
import path from "node:path";
import { scanProjects } from "../../gitScanner.js";
import type { CommandRunner } from "../../lib/commandRunner.js";
import { getConfigDirectory } from "../../preferences.js";
import { getNpmCommand } from "../../runtime.js";
import { loadTransformersProvider, resolveTransformers, TRANSFORMERS_PACKAGE } from "./embeddings.js";
import { createKnowledgeIndex, type KnowledgeIndex } from "./index.js";
import { openKnowledgeStore } from "./store.js";

// Pinned, so enabling semantic search installs exactly the version this code was built against.
export const TRANSFORMERS_VERSION = "4.3.2";

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
          : null,
      async installProvider() {
        // A private package.json keeps the install self-contained in the extensions folder.
        await fs.mkdir(extensions, { recursive: true });
        await fs.writeFile(path.join(extensions, "package.json"), JSON.stringify({ name: "repo-control-extensions", private: true }), { flag: "wx" }).catch(() => undefined);
        const result = await options.runProjectCommand(
          extensions,
          getNpmCommand(),
          ["install", "--no-audit", "--no-fund", "--omit=dev", `${TRANSFORMERS_PACKAGE}@${TRANSFORMERS_VERSION}`],
          20 * 60_000
        );
        return { ok: result.ok, output: result.output };
      }
    });
    return index;
  };
}
