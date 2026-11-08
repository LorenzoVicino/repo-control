import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { scanProjects } from "../../gitScanner.js";
import { runProjectCommand } from "../../lib/commandRunner.js";
import type { EmbeddingProvider } from "./embeddings.js";
import { createKnowledgeIndex } from "./index.js";
import { toFtsQuery } from "./search.js";
import { openKnowledgeStore } from "./store.js";

const execFileAsync = promisify(execFile);

async function repository(root: string, name: string, files: Record<string, string>) {
  const directory = path.join(root, name);
  await fs.mkdir(directory, { recursive: true });
  const git = (...args: string[]) => execFileAsync("git", args, { cwd: directory });
  await git("init", "-b", "main");
  await git("config", "user.email", "t@t.local");
  await git("config", "user.name", "t");
  for (const [file, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(directory, file)), { recursive: true });
    await fs.writeFile(path.join(directory, file), content);
  }
  await git("add", "-A");
  await git("commit", "-m", `Create ${name}`);
  return directory;
}

// A stand-in embedding model: words map to concept dimensions, with synonyms (in two
// languages) sharing one, which is exactly the property semantic search relies on.
const CONCEPTS: Record<string, number> = { invoice: 0, invoices: 0, billing: 0, fatturazione: 0, fatture: 0, orders: 1, shop: 1, docs: 2, guide: 2 };
function fakeProvider(id = "fake:concepts"): EmbeddingProvider {
  return {
    id,
    dimensions: 4,
    async embed(texts) {
      return texts.map((text) => {
        const vector = new Float32Array(4);
        for (const word of text.toLowerCase().match(/\p{L}+/gu) ?? []) if (word in CONCEPTS) vector[CONCEPTS[word]] += 1;
        vector[3] = 0.05;
        const norm = Math.hypot(...vector);
        return vector.map((value) => value / norm);
      });
    }
  };
}

async function workspace(context: test.TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-knowledge-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  await repository(root, "atlas-api", {
    "README.md": "# Atlas API\n\nServes orders for the shop.\n",
    "package.json": JSON.stringify({ name: "atlas-api", description: "Orders API", dependencies: { fastify: "5" } }),
    "src/server.ts": "export {}\n"
  });
  await repository(root, "billing-worker", {
    "README.md": "# Billing worker\n\nGenerates monthly invoices and sends them by email.\n",
    "pyproject.toml": '[project]\nname = "billing"\ndependencies = ["celery"]\n',
    "worker.py": "pass\n"
  });
  await repository(root, "handbook", { "README.md": "# Handbook\n\nThe team guide.\n", "docs/onboarding.md": "# Onboarding\n\nWelcome.\n" });
  return root;
}

test("indexes a workspace incrementally and finds repositories by words, labels and names", async (context) => {
  const root = await workspace(context);
  const store = openKnowledgeStore(":memory:");
  context.after(() => store.close());
  const index = createKnowledgeIndex({ store, getActiveRootPath: () => root, scan: (rootPath) => scanProjects(rootPath), runProjectCommand });

  assert.equal(index.status().state, "idle");
  const first = await index.reindex();
  assert.deepEqual({ updated: first?.updated, skipped: first?.skipped, removed: first?.removed, failed: first?.failed }, { updated: 3, skipped: 0, removed: 0, failed: [] });
  assert.deepEqual(index.status().semantic, { enabled: false, model: null });
  assert.deepEqual(index.repositories().map((repository) => repository.name), ["atlas-api", "billing-worker", "handbook"]);
  assert.deepEqual(index.repositories()[0].labels.map((label) => label.id), ["api", "typescript", "fastify"]);
  assert.match(index.repositories()[0].summary, /^atlas-api: Orders API\./);

  const second = await index.reindex();
  assert.equal(second?.skipped, 3, "unchanged repositories are not re-indexed");

  const fastify = await index.search("which repositories use fastify?");
  assert.equal(fastify[0].repository.name, "atlas-api");
  assert.deepEqual(fastify[0].via.sort(), ["label", "text"]);

  const invoices = await index.search("monthly invoices");
  assert.equal(invoices[0].repository.name, "billing-worker");
  assert.match(invoices[0].matches[0].snippet, /«invoices»/);

  const byName = await index.search("handbook");
  assert.ok(byName[0].via.includes("name"));
  assert.deepEqual(await index.search("zzzz nothing"), []);

  await fs.appendFile(path.join(root, "handbook", "README.md"), "\nNow with a deployment checklist.\n");
  await fs.rm(path.join(root, "atlas-api"), { recursive: true, force: true });
  const third = await index.reindex();
  assert.deepEqual({ updated: third?.updated, skipped: third?.skipped, removed: third?.removed }, { updated: 1, skipped: 1, removed: 1 });
  assert.equal((await index.search("deployment checklist"))[0].repository.name, "handbook");
});

test("with an embedding provider, search also matches meaning and labels gain topics", async (context) => {
  const root = await workspace(context);
  const store = openKnowledgeStore(":memory:");
  context.after(() => store.close());
  const index = createKnowledgeIndex({
    store,
    getActiveRootPath: () => root,
    scan: (rootPath) => scanProjects(rootPath),
    runProjectCommand,
    loadProvider: async () => fakeProvider()
  });

  // The first search of an empty index builds it.
  const italian = await index.search("fatturazione");
  assert.equal(italian[0].repository.name, "billing-worker", "an Italian query finds the English README by meaning");
  assert.deepEqual(italian[0].via, ["semantic"]);
  assert.deepEqual(index.status().semantic, { enabled: true, model: "fake:concepts" });
  assert.ok(store.vectors(root).length > 0);
  const billing = index.repositories().find((repository) => repository.name === "billing-worker");
  const topic = billing?.labels.find((label) => label.kind === "topic");
  assert.equal(topic?.id, "payments", "the topic is matched by meaning, not by a keyword rule");
  assert.match(billing?.summary ?? "", /Topics: payments\./);

  // Switching models drops the old vectors and re-embeds everything.
  const switched = createKnowledgeIndex({ store, getActiveRootPath: () => root, scan: (rootPath) => scanProjects(rootPath), runProjectCommand, loadProvider: async () => fakeProvider("fake:v2") });
  const run = await switched.reindex();
  assert.equal(run?.updated, 3);
});

test("free text becomes a safe FTS5 query", () => {
  assert.equal(toFtsQuery('Where is "billing" (v2)? a'), '"where"* OR "is"* OR "billing"* OR "v2"*');
  assert.equal(toFtsQuery("NEAR(x y) OR -z"), '"near"* OR "or"*');
  assert.equal(toFtsQuery("??"), "");
});
