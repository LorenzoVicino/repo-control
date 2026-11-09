import assert from "node:assert/strict";
import test from "node:test";
import { buildWorkspaceGraph, isDistinctiveName, relationsOf } from "./graph.js";
import type { RepositoryLabel } from "./labels.js";
import type { StoredChunk, StoredRepository } from "./store.js";

const label = (id: string, kind: RepositoryLabel["kind"]): RepositoryLabel => ({ id, kind, evidence: `evidence for ${id}`, confidence: 0.9 });

function repository(id: string, labels: RepositoryLabel[] = [], facts: Partial<StoredRepository["facts"]> = {}): StoredRepository {
  return {
    root: "/workspace",
    id,
    name: id,
    relativePath: id,
    fingerprint: "f",
    indexedAt: "2026-11-09T00:00:00.000Z",
    labels,
    summary: id,
    facts: { packages: [], dependencies: [], ...facts }
  };
}

let rowid = 0;
const chunk = (repositoryId: string, text: string, path = "README.md", kind: StoredChunk["kind"] = "readme"): StoredChunk => ({ rowid: ++rowid, repositoryId, path, kind, text: `${repositoryId} · ${text}` });

const workspace = [
  repository("shared-utils", [label("library", "kind"), label("typescript", "language")], { packages: ["@atlas/shared-utils"] }),
  repository("atlas-web", [label("web app", "kind"), label("typescript", "language"), label("react", "framework"), label("tests", "tooling")], { dependencies: ["react", "@Atlas/Shared-Utils"] }),
  repository("atlas-api", [label("api", "kind"), label("typescript", "language"), label("fastify", "framework")], { dependencies: ["@atlas/shared-utils", "fastify"] }),
  repository("mobile-app", [label("mobile", "kind"), label("typescript", "language"), label("react", "framework")]),
  repository("docs", [label("documentation", "kind")]),
  repository("server", [])
];

test("edges explain how repositories relate: dependencies, mentions, labels", () => {
  const graph = buildWorkspaceGraph(workspace, [
    chunk("docs", "The atlas-web storefront calls atlas-api. See github.com/acme/mobile-app and @mobile-app."),
    chunk("docs", "Deploy atlas-web.github.io from the server.", "docs/deploy.md", "doc"),
    chunk("atlas-api", "Shared helpers live in shared-utils."),
    chunk("atlas-web", "Mentions server and atlas-webhooks.", "", "commits")
  ]);

  const edges = graph.edges.filter((edge) => edge.type !== "labelled").map((edge) => `${edge.type} ${edge.source}->${edge.target}: ${edge.evidence.join(" | ")}`).sort();
  assert.deepEqual(edges, [
    "depends_on atlas-api->shared-utils: depends on @atlas/shared-utils",
    "depends_on atlas-web->shared-utils: depends on @Atlas/Shared-Utils",
    "references docs->atlas-api: README.md mentions atlas-api",
    "references docs->atlas-web: README.md mentions atlas-web"
  ]);
  // Not mentions: a dependency already explains atlas-api → shared-utils, a URL path, a handle,
  // a longer host name, a longer word, and "server", which is an ordinary word.

  const labelNodes = graph.nodes.filter((node) => node.type === "label");
  assert.deepEqual(
    labelNodes.map((node) => (node.type === "label" ? `${node.labelKind}:${node.name}:${node.count}` : "")).sort(),
    ["framework:fastify:1", "framework:react:2", "kind:api:1", "kind:documentation:1", "kind:library:1", "kind:mobile:1", "kind:web app:1", "language:typescript:4"]
  );
  assert.ok(!graph.nodes.some((node) => node.name === "tests"), "tooling labels are not drawn as nodes");
  assert.deepEqual(graph.nodes.find((node) => node.id === "atlas-web"), { id: "atlas-web", type: "repository", name: "atlas-web", relativePath: "atlas-web", kind: "web app", labels: ["web app", "typescript", "react", "tests"] });
  assert.equal(graph.edges.find((edge) => edge.type === "labelled" && edge.source === "atlas-api" && edge.target === "label:framework:fastify")?.evidence[0], "evidence for fastify");
});

test("similar edges come from summary vectors, once per pair, above a threshold", () => {
  const vector = (...values: number[]) => {
    const raw = Float32Array.from(values);
    const norm = Math.hypot(...raw);
    return raw.map((value) => value / norm);
  };
  const graph = buildWorkspaceGraph(workspace.slice(0, 4), [], new Map([
    ["atlas-web", vector(1, 0.1, 0)],
    ["mobile-app", vector(1, 0.2, 0)],
    ["atlas-api", vector(0, 1, 0)],
    ["shared-utils", vector(0, 0, 1)]
  ]));
  const similar = graph.edges.filter((edge) => edge.type === "similar");
  assert.equal(similar.length, 1);
  assert.equal(`${similar[0].source}->${similar[0].target}`, "atlas-web->mobile-app");
  assert.equal(similar[0].evidence[0], "summaries 100% similar");
});

test("relations group what the graph knows about one repository", () => {
  const graph = buildWorkspaceGraph(workspace, [chunk("docs", "shared-utils is documented here."), chunk("shared-utils", "Used by atlas-api.")]);
  const relations = relationsOf(graph, workspace, "shared-utils");
  assert.ok(relations);
  assert.deepEqual(relations.usedBy.map((entry) => entry.repository.name), ["atlas-api", "atlas-web"]);
  assert.deepEqual(relations.mentionedBy.map((entry) => entry.repository.name), ["docs"]);
  // The dependency points the other way (atlas-api → shared-utils), so this mention stays.
  assert.deepEqual(relations.mentions.map((entry) => entry.repository.name), ["atlas-api"]);
  assert.equal(relationsOf(graph, workspace, "atlas-web")?.sharesLabels[0]?.repository.name, undefined, "two shared labels are needed, not just one");
  assert.deepEqual(relationsOf(graph, workspace, "missing"), null);

  const shared = relationsOf(buildWorkspaceGraph(workspace, []), [...workspace, repository("atlas-native", [label("mobile", "kind"), label("react", "framework")])], "mobile-app");
  assert.deepEqual(shared?.sharesLabels, [{ repository: shared?.sharesLabels[0].repository, labels: ["mobile", "react"] }]);
});

test("only names a person would not use as a plain word count as mentions", () => {
  assert.equal(isDistinctiveName("atlas-api"), true);
  assert.equal(isDistinctiveName("Acme.Payments"), true);
  assert.equal(isDistinctiveName("AcmeTools"), true);
  assert.equal(isDistinctiveName("mirroring"), false);
  assert.equal(isDistinctiveName("api"), false);
});
