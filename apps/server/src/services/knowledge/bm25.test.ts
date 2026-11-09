import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { buildTextIndex, normalize, queryTerms } from "./bm25.js";
import { openKnowledgeStore } from "./store.js";

test("query words are normalised, deduplicated and capped; punctuation never reaches a parser", () => {
  assert.deepEqual(queryTerms('Where is "billing" (v2)? a NEAR(x) Fatturazióne fatturazione'), ["where", "is", "billing", "v2", "near", "fatturazione"]);
  assert.deepEqual(queryTerms("??"), []);
  assert.equal(normalize("Città"), "citta");
});

test("BM25 ranks rarer and denser matches higher and expands prefixes once per word", () => {
  const index = buildTextIndex([
    { id: 1, text: "atlas · Serves orders for the shop. Orders are paid by card." },
    { id: 2, text: "billing · Generates monthly invoices and retries failed payments." },
    { id: 3, text: "handbook · The team guide covers orders of business, holidays and the shop floor." },
    { id: 4, text: "notes · Shop shop shop shop shop shop." }
  ]);

  const orders = index.search("orders", 10);
  assert.deepEqual(orders.map((match) => match.id), [1, 3], "two mentions beat one");
  assert.match(orders[0].snippet, /Serves «orders» for the shop\. «Orders» are paid/);

  assert.deepEqual(index.search("invoice", 10).map((match) => match.id), [2], "a word matches as a prefix, as in invoice → invoices");
  assert.deepEqual(index.search("orders invoices", 10).map((match) => match.id).sort(), [1, 2, 3]);
  const shop = index.search("shop", 10);
  assert.equal(shop[0].id, 4, "term frequency counts, with diminishing returns");
  assert.ok(shop[0].score < 3 * shop[1].score, "BM25 saturation keeps repetition from dominating");
  assert.deepEqual(index.search("zzz", 10), []);
  assert.deepEqual(buildTextIndex([]).search("anything", 5), []);
});

test("snippets centre on the first match and mark every matching word", () => {
  const long = `${"filler ".repeat(40)}the deployment checklist lives here ${"tail ".repeat(40)}`;
  const [match] = buildTextIndex([{ id: 1, text: long }]).search("deployment checklist", 1);
  assert.match(match.snippet, /^….*the «deployment» «checklist» lives here.*…$/);
});

test("a store from the FTS5 era is rebuilt rather than misread", async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-store-"));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, "knowledge.sqlite");
  const old = new DatabaseSync(file);
  old.exec("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); INSERT INTO meta VALUES ('schema', '1'); CREATE TABLE chunks (text TEXT); INSERT INTO chunks VALUES ('stale');");
  old.close();

  const store = openKnowledgeStore(file);
  context.after(() => store.close());
  assert.deepEqual(store.listRepositories("/workspace"), []);
  store.saveRepository(
    { root: "/workspace", id: "a", name: "atlas", relativePath: "atlas", fingerprint: "f", indexedAt: "2026-11-09T00:00:00.000Z", labels: [], summary: "atlas" },
    [{ path: "README.md", kind: "readme", text: "atlas · orders" }],
    null
  );
  assert.equal(store.searchText("/workspace", "orders", 5)[0].repositoryId, "a");
  assert.deepEqual(store.searchText("/elsewhere", "orders", 5), [], "results are scoped to their workspace root");
});
