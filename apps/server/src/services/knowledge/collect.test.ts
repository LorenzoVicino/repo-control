import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { runProjectCommand } from "../../lib/commandRunner.js";
import { collectRepositoryDocuments, composeServiceNames, languageShares, parseManifest } from "./collect.js";

const execFileAsync = promisify(execFile);

test("manifests of every supported ecosystem yield names, descriptions and dependencies", () => {
  const npm = parseManifest(
    "package.json",
    JSON.stringify({ name: "atlas", description: "Orders API", private: true, bin: { atlas: "x" }, workspaces: ["a"], dependencies: { fastify: "5" }, devDependencies: { vitest: "4" }, scripts: { test: "x" } })
  );
  assert.deepEqual(npm, {
    path: "package.json",
    kind: "npm",
    name: "atlas",
    description: "Orders API",
    dependencies: ["fastify", "vitest"],
    scripts: ["test"],
    flags: { bin: true, workspaces: true, private: true }
  });

  const pyproject = parseManifest(
    "pyproject.toml",
    [
      "[project]",
      'name = "billing"',
      'description = "Invoices"',
      'requires-python = ">=3.11"',
      'classifiers = ["Framework :: Django", "Programming Language :: Python"]',
      "dependencies = [",
      '  "fastapi>=0.110",',
      '  "pydantic[email]~=2.0",',
      "]",
      "[project.optional-dependencies]",
      'test = ["pytest"]',
      "[tool.poetry.dependencies]",
      'python = "^3.11"',
      'httpx = "^0.27"'
    ].join("\n")
  );
  assert.equal(pyproject?.name, "billing");
  assert.deepEqual(pyproject?.dependencies.sort(), ["fastapi", "httpx", "pydantic", "pytest"]);

  assert.deepEqual(parseManifest("requirements.txt", "# comment\nDjango==5.0\n-r other.txt\nrequests>=2 ; python_version>'3'\n")?.dependencies, ["django", "requests"]);
  assert.deepEqual(parseManifest("Cargo.toml", '[package]\nname = "cache"\n[dependencies]\ntokio = "1"\nserde = { version = "1" }')?.dependencies.slice(-2), ["tokio", "serde"]);
  assert.deepEqual(parseManifest("go.mod", "module example.com/api\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n)\n")?.dependencies, ["github.com/gin-gonic/gin"]);
  const pom = parseManifest(
    "pom.xml",
    "<project><parent><artifactId>spring-boot-starter-parent</artifactId></parent><artifactId>orders-service</artifactId>" +
      "<description>Orders</description><dependencies><dependency><artifactId>spring-boot-starter-web</artifactId></dependency>" +
      "<dependency><artifactId>shared-model</artifactId></dependency></dependencies></project>"
  );
  assert.equal(pom?.name, "orders-service", "the project's own artifactId, not the parent's");
  assert.equal(pom?.description, "Orders");
  assert.deepEqual(pom?.dependencies, ["spring-boot-starter-parent", "spring-boot-starter-web", "shared-model"]);
  assert.deepEqual(parseManifest("src/Api.csproj", '<PackageReference Include="Microsoft.AspNetCore.OpenApi" Version="8" />')?.dependencies, ["Microsoft.AspNetCore.OpenApi"]);
  assert.deepEqual(parseManifest("composer.json", JSON.stringify({ require: { "laravel/framework": "^11" } }))?.dependencies, ["laravel/framework"]);
  assert.deepEqual(parseManifest("Gemfile", "gem 'rails', '~> 7'\ngem \"pg\"")?.dependencies, ["rails", "pg"]);
  assert.equal(parseManifest("package.json", "{ not json"), null);
  assert.equal(parseManifest("README.md", "# hi"), null);
});

test("compose services and language shares are read from plain text", () => {
  assert.deepEqual(composeServiceNames("name: x\nservices:\n  api:\n    image: a\n    environment:\n      KEY: v\n  db:\n    image: b\nvolumes:\n  data:\n"), ["api", "db"]);
  assert.deepEqual(languageShares(["a.ts", "b.tsx", "c.py", "README.md", "logo.png"]), [
    { name: "TypeScript", share: 0.5 },
    { name: "Python", share: 0.25 },
    { name: "Markdown", share: 0.25 }
  ]);
});

test("collection reads tracked and new files but never ignored ones", async (context) => {
  const repository = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-collect-"));
  context.after(() => fs.rm(repository, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileAsync("git", args, { cwd: repository });
  await git("init", "-b", "main");
  await git("config", "user.email", "t@t.local");
  await git("config", "user.name", "t");
  await fs.mkdir(path.join(repository, "docs"));
  await fs.writeFile(path.join(repository, "README.md"), "# Atlas\n\nAtlas serves the orders API for the shop.\n");
  await fs.writeFile(path.join(repository, "docs", "deploy.md"), "# Deploy\n\nRun compose up.\n");
  await fs.writeFile(path.join(repository, "package.json"), JSON.stringify({ name: "atlas", dependencies: { fastify: "5" } }));
  await fs.writeFile(path.join(repository, "compose.yml"), "services:\n  api:\n    image: node\n");
  await fs.writeFile(path.join(repository, "server.ts"), "export {}\n");
  await fs.writeFile(path.join(repository, ".gitignore"), "secrets.env\n");
  await fs.writeFile(path.join(repository, "secrets.env"), "TOKEN=abc\n");
  await git("add", "-A");
  await git("commit", "-m", "Serve orders");
  await fs.writeFile(path.join(repository, "notes.ts"), "export {}\n");

  const docs = await collectRepositoryDocuments(repository, runProjectCommand);
  assert.match(docs.head, /^[0-9a-f]{40}$/);
  assert.ok(docs.files.includes("notes.ts"), "untracked files that are not ignored count");
  assert.ok(!docs.files.includes("secrets.env"), "ignored files are never read");
  assert.equal(docs.readme?.path, "README.md");
  assert.deepEqual(docs.docs.map((doc) => doc.path), ["docs/deploy.md"]);
  assert.deepEqual(docs.manifests.map((manifest) => manifest.dependencies), [["fastify"]]);
  assert.deepEqual(docs.composeServices, ["api"]);
  assert.deepEqual(docs.commits, ["Serve orders"]);
  assert.equal(docs.languages[0].name, "TypeScript");
});
