import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import Fastify from "fastify";
import { scanProjects } from "../gitScanner.js";
import { runProjectCommand, runShellCommand } from "../lib/commandRunner.js";
import { createProjectResolver } from "../lib/projectResolver.js";
import { createKnowledgeIndex } from "../services/knowledge/index.js";
import { openKnowledgeStore } from "../services/knowledge/store.js";
import { createToolkit } from "../services/tools/index.js";
import { registerKnowledgeRoutes } from "./knowledgeRoutes.js";

const execFileAsync = promisify(execFile);

async function setup(context: test.TestContext) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-knowledge-routes-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const [name, files] of Object.entries({
    "atlas-api": { "package.json": JSON.stringify({ name: "atlas-api", dependencies: { fastify: "5", react: "19" } }), "server.ts": "export {}\n" },
    docs: { "README.md": "# Docs\n\nDeployment guide for the platform.\n" }
  })) {
    const directory = path.join(root, name);
    await fs.mkdir(directory);
    for (const [file, content] of Object.entries(files)) await fs.writeFile(path.join(directory, file), content);
    for (const args of [["init", "-b", "main"], ["config", "user.email", "t@t.local"], ["config", "user.name", "t"], ["add", "-A"], ["commit", "-m", "init"]]) {
      await execFileAsync("git", args, { cwd: directory });
    }
  }
  const store = openKnowledgeStore(":memory:");
  context.after(() => store.close());
  const knowledgeIndex = createKnowledgeIndex({ store, getActiveRootPath: () => root, scan: (rootPath) => scanProjects(rootPath), runProjectCommand });
  return { root, knowledge: () => knowledgeIndex };
}

test("knowledge routes report status, index in the background, list labels and search", async (context) => {
  const { knowledge } = await setup(context);
  const app = Fastify();
  context.after(() => app.close());
  await registerKnowledgeRoutes(app, { knowledge });

  const status = await app.inject({ url: "/api/knowledge" });
  assert.equal(status.json().state, "idle");
  assert.equal(status.json().indexed, 0);

  const started = await app.inject({ method: "POST", url: "/api/knowledge/reindex" });
  assert.equal(started.statusCode, 202);
  assert.equal(started.json().state, "indexing");
  await knowledge().reindex();

  const repositories = (await app.inject({ url: "/api/knowledge/repositories" })).json().repositories as Array<{ name: string; labels: Array<{ id: string }> }>;
  assert.deepEqual(repositories.map((repository) => repository.name), ["atlas-api", "docs"]);
  assert.ok(repositories[0].labels.some((label) => label.id === "fastify"));

  const search = (await app.inject({ url: "/api/knowledge/search?q=deployment%20guide" })).json();
  assert.equal(search.hits[0].name, "docs");
  assert.deepEqual(search.hits[0].via, ["text"]);
  assert.equal((await app.inject({ url: "/api/knowledge/search?q=a" })).statusCode, 400);

  const semantic = await app.inject({ method: "POST", url: "/api/knowledge/semantic" });
  assert.equal(semantic.statusCode, 409, "an index without an installer cannot enable semantic search");
  assert.equal(semantic.json().code, "SEMANTIC_NOT_INSTALLABLE");
});

test("the agent searches the workspace and filters repositories by label", async (context) => {
  const { root, knowledge } = await setup(context);
  const toolkit = createToolkit({ ...createProjectResolver(root), runProjectCommand, runShellCommand, knowledge });

  const found = await toolkit.run("search_workspace", { query: "which repositories use react?" });
  assert.equal(found.isError, false);
  assert.match(found.text, /^1 repositories match "which repositories use react\?" \(full-text search\):\n1\. atlas-api \(atlas-api\) \[web app, api, typescript, react, fastify\]/);

  const none = await toolkit.run("search_workspace", { query: "kubernetes helm" });
  assert.equal(none.text, 'No repository matches "kubernetes helm" (full-text search).');

  const listed = await toolkit.run("list_repositories", { label: "fastify" });
  assert.match(listed.text, /^1 of 2 repositories \(label fastify\)\.\n- atlas-api \(atlas-api\) on main, no upstream: clean and in sync \[web app, api, typescript, react, fastify\]$/);

  const withoutIndex = createToolkit({ ...createProjectResolver(root), runProjectCommand, runShellCommand });
  assert.deepEqual(await withoutIndex.run("search_workspace", { query: "react" }), { isError: true, text: "The knowledge index is not available in this context." });
  assert.equal((await withoutIndex.run("list_repositories", { label: "react" })).isError, true);
});
