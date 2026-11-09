import { promises as fs } from "node:fs";
import path from "node:path";
import type { CommandRunner } from "../../lib/commandRunner.js";

// What the knowledge index reads from a repository: tracked files only (git ls-files, so
// .gitignore is respected and nothing outside the repository is touched), a handful of
// manifests, the README and a few docs, Compose service names and recent commit subjects.
// Every read is capped, so one huge repository cannot stall indexing.

export type Manifest = {
  path: string;
  kind: "npm" | "python" | "rust" | "go" | "java" | "dotnet" | "php" | "ruby";
  name: string | null;
  description: string | null;
  dependencies: string[];
  scripts: string[];
  /** npm only: has a "bin" entry, "workspaces", is published (not private). */
  flags: { bin: boolean; workspaces: boolean; private: boolean };
};

export type TextDocument = { path: string; text: string };

export type RepositoryDocuments = {
  head: string;
  fileCount: number;
  files: string[];
  languages: Array<{ name: string; share: number }>;
  manifests: Manifest[];
  readme: TextDocument | null;
  docs: TextDocument[];
  composeServices: string[];
  commits: string[];
};

const MAX_FILES = 20_000;
const MAX_TEXT = 40_000;
const MAX_DOC_TEXT = 16_000;
const MAX_DOCS = 5;
const MAX_MANIFESTS = 12;

const LANGUAGES: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", mts: "TypeScript", cts: "TypeScript",
  js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  py: "Python", rs: "Rust", go: "Go", java: "Java", kt: "Kotlin", kts: "Kotlin",
  cs: "C#", fs: "F#", vb: "Visual Basic", php: "PHP", rb: "Ruby", swift: "Swift",
  m: "Objective-C", c: "C", h: "C", cpp: "C++", cc: "C++", hpp: "C++",
  dart: "Dart", scala: "Scala", ex: "Elixir", exs: "Elixir", erl: "Erlang",
  lua: "Lua", r: "R", jl: "Julia", sh: "Shell", bash: "Shell", ps1: "PowerShell",
  vue: "Vue", svelte: "Svelte", html: "HTML", css: "CSS", scss: "SCSS", less: "Less",
  sql: "SQL", tf: "Terraform", md: "Markdown", mdx: "Markdown"
};

export function languageOf(file: string): string | null {
  const extension = path.extname(file).slice(1).toLowerCase();
  return LANGUAGES[extension] ?? null;
}

export function languageShares(files: readonly string[]): Array<{ name: string; share: number }> {
  const counts = new Map<string, number>();
  for (const file of files) {
    const language = languageOf(file);
    if (language) counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, share: total ? Math.round((count / total) * 1000) / 1000 : 0 }))
    .sort((a, b) => b.share - a.share);
}

async function readCapped(file: string, limit: number): Promise<string | null> {
  try {
    const handle = await fs.open(file, "r");
    try {
      const buffer = Buffer.alloc(limit);
      const { bytesRead } = await handle.read(buffer, 0, limit, 0);
      const text = buffer.subarray(0, bytesRead).toString("utf8");
      return text.includes("\u0000") ? null : text;
    } finally {
      await handle.close();
    }
  } catch {
    return null;
  }
}

const depth = (file: string) => file.split("/").length - 1;

function lines(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.trim());
}

/** Parses the manifests the labels and summaries need, tolerating any malformed file. */
export function parseManifest(file: string, text: string): Manifest | null {
  const base = path.basename(file);
  const empty = { name: null, description: null, dependencies: [] as string[], scripts: [] as string[], flags: { bin: false, workspaces: false, private: false } };

  try {
    if (base === "package.json") {
      const json = JSON.parse(text) as Record<string, unknown>;
      const keys = (value: unknown) => (value && typeof value === "object" ? Object.keys(value as object) : []);
      return {
        path: file,
        kind: "npm",
        name: typeof json.name === "string" ? json.name : null,
        description: typeof json.description === "string" ? json.description : null,
        dependencies: [...new Set([...keys(json.dependencies), ...keys(json.devDependencies), ...keys(json.peerDependencies)])],
        scripts: keys(json.scripts),
        flags: { bin: Boolean(json.bin), workspaces: Boolean(json.workspaces), private: json.private === true }
      };
    }
    if (base === "pyproject.toml" || base === "requirements.txt") {
      const dependencies = base === "requirements.txt" ? requirementNames(text) : pyprojectDependencies(text);
      const name = /^\s*name\s*=\s*"([^"]+)"/m.exec(text)?.[1] ?? null;
      const description = /^\s*description\s*=\s*"([^"]+)"/m.exec(text)?.[1] ?? null;
      return { ...empty, path: file, kind: "python", name, description, dependencies: [...new Set(dependencies)] };
    }
    if (base === "Cargo.toml") {
      const dependencies = [...text.matchAll(/^\s*([A-Za-z0-9_-]+)\s*=/gm)].map((match) => match[1]);
      return { ...empty, path: file, kind: "rust", name: /^\s*name\s*=\s*"([^"]+)"/m.exec(text)?.[1] ?? null, description: /^\s*description\s*=\s*"([^"]+)"/m.exec(text)?.[1] ?? null, dependencies };
    }
    if (base === "go.mod") {
      const dependencies = [...text.matchAll(/^\s*(?:require\s+)?([a-z0-9.-]+\.[a-z]+\/[^\s]+)\s+v/gm)].map((match) => match[1]);
      return { ...empty, path: file, kind: "go", name: /^module\s+(\S+)/m.exec(text)?.[1] ?? null, dependencies };
    }
    if (base === "pom.xml" || base === "build.gradle" || base === "build.gradle.kts") {
      // The project's own artifactId is the first one outside <parent>, <dependencies>,
      // <dependencyManagement>, <build> and <plugins>; the rest are dependencies.
      const own = base === "pom.xml"
        ? /<artifactId>([^<]+)<\/artifactId>/.exec(text.replace(/<(parent|dependencies|dependencyManagement|build|plugins|profiles)>[\s\S]*?<\/\1>/g, ""))?.[1] ?? null
        : null;
      const dependencies = [...text.matchAll(/<artifactId>([^<]+)<\/artifactId>|["']([a-z0-9.-]+:[a-z0-9.-]+)(?::[^"']*)?["']/gi)]
        .map((match) => (match[1] ?? match[2]).toLowerCase())
        .filter((name) => name !== own?.toLowerCase());
      const description = base === "pom.xml" ? /<description>([^<]+)<\/description>/.exec(text)?.[1]?.trim() ?? null : null;
      return { ...empty, path: file, kind: "java", name: own, description, dependencies: [...new Set(dependencies)] };
    }
    if (base.endsWith(".csproj")) {
      const dependencies = [...text.matchAll(/PackageReference\s+Include="([^"]+)"/g)].map((match) => match[1]);
      return { ...empty, path: file, kind: "dotnet", name: base.replace(/\.csproj$/, ""), dependencies };
    }
    if (base === "composer.json") {
      const json = JSON.parse(text) as Record<string, unknown>;
      const keys = (value: unknown) => (value && typeof value === "object" ? Object.keys(value as object) : []);
      return { ...empty, path: file, kind: "php", name: typeof json.name === "string" ? json.name : null, description: typeof json.description === "string" ? json.description : null, dependencies: [...keys(json.require), ...keys(json["require-dev"])] };
    }
    if (base === "Gemfile") {
      return { ...empty, path: file, kind: "ruby", dependencies: [...text.matchAll(/^\s*gem\s+["']([^"']+)["']/gm)].map((match) => match[1]) };
    }
  } catch {
    return null;
  }
  return null;
}

const packageName = (spec: string) => spec.trim().split(/[<>=!~[;\s(@]/)[0].toLowerCase();

function requirementNames(text: string): string[] {
  return lines(text).filter((line) => line && !line.startsWith("#") && !line.startsWith("-")).map(packageName).filter(Boolean);
}

/**
 * PEP 621 `dependencies = [...]` in [project] and every array in [project.optional-dependencies],
 * plus the keys of Poetry's dependency tables. Other arrays (classifiers, keywords) are ignored.
 */
function pyprojectDependencies(text: string): string[] {
  const names = new Set<string>();
  let section = "";
  let collecting = false;
  for (const line of text.split(/\r?\n/)) {
    const header = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (header) {
      section = header[1].trim();
      collecting = false;
      continue;
    }
    const isPoetry = /^tool\.poetry\.(?:group\.[^.]+\.)?(?:dev-)?dependencies$/.test(section);
    if (isPoetry) {
      const key = /^\s*([A-Za-z0-9_.-]+)\s*=/.exec(line)?.[1];
      if (key && key.toLowerCase() !== "python") names.add(key.toLowerCase());
      continue;
    }
    const assignment = /^\s*([A-Za-z0-9_-]+)\s*=\s*\[(.*)$/.exec(line);
    if (assignment) collecting = (section === "project" && assignment[1] === "dependencies") || section === "project.optional-dependencies";
    if (collecting) {
      for (const quoted of line.matchAll(/["']([^"']+)["']/g)) names.add(packageName(quoted[1]));
      if (line.includes("]")) collecting = false;
    }
  }
  names.delete("");
  return [...names];
}

const MANIFEST_FILE = /(^|\/)(package\.json|pyproject\.toml|requirements\.txt|Cargo\.toml|go\.mod|pom\.xml|build\.gradle(\.kts)?|[^/]+\.csproj|composer\.json|Gemfile)$/;
const COMPOSE_FILE = /^(docker-)?compose\.ya?ml$/;

export function composeServiceNames(text: string): string[] {
  const services: string[] = [];
  let inServices = false;
  let indent = -1;
  for (const line of text.split(/\r?\n/)) {
    if (/^services:\s*$/.test(line)) {
      inServices = true;
      continue;
    }
    if (inServices && /^\S/.test(line)) break;
    const match = /^(\s+)([A-Za-z0-9._-]+):\s*$/.exec(line);
    if (inServices && match) {
      if (indent === -1) indent = match[1].length;
      if (match[1].length === indent) services.push(match[2]);
    }
  }
  return services;
}

export async function collectRepositoryDocuments(repositoryPath: string, run: CommandRunner): Promise<RepositoryDocuments> {
  const [listing, head, log] = await Promise.all([
    run(repositoryPath, "git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], 30_000),
    run(repositoryPath, "git", ["rev-parse", "HEAD"], 10_000),
    run(repositoryPath, "git", ["log", "-n", "40", "--no-merges", "--format=%s"], 15_000)
  ]);
  const allFiles = listing.ok ? listing.stdout.split("\u0000").filter(Boolean) : [];
  const files = allFiles.slice(0, MAX_FILES);

  const manifestFiles = files.filter((file) => MANIFEST_FILE.test(file) && depth(file) <= 3 && !file.includes("node_modules/")).sort((a, b) => depth(a) - depth(b)).slice(0, MAX_MANIFESTS);
  const manifests = (
    await Promise.all(manifestFiles.map(async (file) => {
      const text = await readCapped(path.join(repositoryPath, file), MAX_TEXT);
      return text === null ? null : parseManifest(file, text);
    }))
  ).filter((manifest): manifest is Manifest => manifest !== null);

  const readmeFile = files.filter((file) => depth(file) === 0 && /^readme(\.(md|markdown|rst|txt))?$/i.test(file)).sort()[0];
  const readmeText = readmeFile ? await readCapped(path.join(repositoryPath, readmeFile), MAX_TEXT) : null;

  const docFiles = files.filter((file) => /^docs?\/[^/]+\.mdx?$/i.test(file) || (depth(file) === 0 && /^(architecture|contributing|design|overview)\.md$/i.test(file))).slice(0, MAX_DOCS);
  const docs = (await Promise.all(docFiles.map(async (file) => ({ path: file, text: await readCapped(path.join(repositoryPath, file), MAX_DOC_TEXT) })))).filter(
    (doc): doc is TextDocument => Boolean(doc.text?.trim())
  );

  const composeFile = files.find((file) => depth(file) === 0 && COMPOSE_FILE.test(file));
  const composeText = composeFile ? await readCapped(path.join(repositoryPath, composeFile), MAX_TEXT) : null;

  return {
    head: head.ok ? head.stdout.trim() : "none",
    fileCount: allFiles.length,
    files,
    languages: languageShares(files),
    manifests,
    readme: readmeFile && readmeText?.trim() ? { path: readmeFile, text: readmeText } : null,
    docs,
    composeServices: composeText ? composeServiceNames(composeText) : [],
    commits: log.ok ? log.stdout.split("\n").map((line) => line.trim()).filter(Boolean) : []
  };
}
