import assert from "node:assert/strict";
import test from "node:test";
import type { RepositoryDocuments } from "./collect.js";
import { chunkRepository, splitMarkdown, summarize } from "./chunk.js";
import { deriveLabels } from "./labels.js";

function docs(overrides: Partial<RepositoryDocuments>): RepositoryDocuments {
  return { head: "abc", fileCount: 0, files: [], languages: [], manifests: [], readme: null, docs: [], composeServices: [], commits: [], ...overrides };
}

const npm = (dependencies: string[], flags: Partial<{ bin: boolean; workspaces: boolean; private: boolean }> = {}, file = "package.json") => ({
  path: file,
  kind: "npm" as const,
  name: "x",
  description: "Orders API for the shop",
  dependencies,
  scripts: [],
  flags: { bin: false, workspaces: false, private: true, ...flags }
});

test("labels name what a repository is and say why", () => {
  const labels = deriveLabels(
    docs({
      files: ["src/server.ts", "src/server.test.ts", "Dockerfile", ".github/workflows/ci.yml", "web/App.tsx"],
      languages: [{ name: "TypeScript", share: 0.8 }, { name: "Markdown", share: 0.15 }, { name: "CSS", share: 0.05 }],
      manifests: [npm(["fastify", "react", "vitest"], { bin: true })],
      composeServices: ["api", "db"]
    })
  );
  const byId = new Map(labels.map((label) => [label.id, label]));
  assert.deepEqual([...byId.keys()].sort(), ["api", "cli", "docker", "fastify", "github actions", "react", "tests", "typescript", "vitest", "web app"].sort());
  assert.equal(byId.get("fastify")?.evidence, "dependency fastify");
  assert.equal(byId.get("vitest")?.kind, "tooling");
  assert.equal(byId.get("typescript")?.evidence, "94% of source files", "Markdown does not dilute the language mix");
  assert.equal(byId.get("docker")?.evidence, "Compose services: api, db");
  assert.equal(labels[0].kind, "kind", "what the repository is comes first");
});

test("kind labels cover libraries, monorepos, docs, mobile, data and infrastructure", () => {
  const ids = (input: Partial<RepositoryDocuments>) => deriveLabels(docs(input)).map((label) => label.id);
  assert.ok(ids({ manifests: [npm(["lodash"], { private: false })] }).includes("library"));
  assert.ok(ids({ manifests: [npm([], { workspaces: true })] }).includes("monorepo"));
  assert.ok(ids({ manifests: [npm([], {}, "apps/a/package.json"), npm([], {}, "apps/b/package.json")] }).includes("monorepo"));
  assert.ok(ids({ languages: [{ name: "Markdown", share: 0.9 }] }).includes("documentation"));
  assert.ok(ids({ files: ["pubspec.yaml"] }).includes("mobile"));
  assert.ok(ids({ manifests: [{ ...npm([]), kind: "python", dependencies: ["pandas", "torch"] }] }).includes("data & ml"));
  assert.ok(ids({ files: ["main.tf"] }).includes("infrastructure"));
  assert.deepEqual(ids({ languages: [{ name: "Go", share: 0.9 }, { name: "Shell", share: 0.1 }] }), ["go"], "minor languages are left out");
});

test("summaries and chunks make every repository findable by its name and content", () => {
  const input = docs({
    readme: { path: "README.md", text: `# Atlas\n\n![badge](x.svg)\n\nAtlas serves the orders API for the shop and talks to billing.\n\n## Setup\n\n${"Install it. ".repeat(150)}` },
    manifests: [npm(["fastify"])],
    commits: ["Add invoices endpoint"],
    composeServices: ["api"]
  });
  const labels = deriveLabels(input);
  const summary = summarize("atlas", input, labels);
  assert.match(summary, /^atlas: Orders API for the shop\.\nAtlas serves the orders API/);
  assert.match(summary, /Frameworks: fastify\./);
  assert.match(summary, /Docker Compose services: api\./);

  const chunks = chunkRepository("atlas", input, labels);
  assert.deepEqual([...new Set(chunks.map((chunk) => chunk.kind))], ["summary", "readme", "manifest", "commits"]);
  assert.ok(chunks.slice(1).every((chunk) => chunk.text.startsWith("atlas · ")));
  assert.ok(chunks.every((chunk) => chunk.text.length <= 1_200 + "atlas · ".length));
});

test("Markdown splits at headings first and paragraphs second", () => {
  assert.deepEqual(splitMarkdown("intro\n# A\none\n## B\ntwo"), ["intro", "# A\none", "## B\ntwo"]);
  const long = splitMarkdown(`# Long\n\n${"a".repeat(50)}\n\n${"b".repeat(50)}`, 60);
  assert.equal(long.length, 2);
  assert.ok(long.every((piece) => piece.length <= 60));
});
