import type { RepositoryDocuments } from "./collect.js";

// Labels describe a repository in words a person would search for. Rule-based labels come
// from evidence the index can point to (a dependency, a file, the language mix) and say
// where they came from, so the dashboard and the agent can explain a label instead of just
// asserting it. Topic labels from embeddings are added on top when semantic search is on.

export type LabelKind = "language" | "framework" | "kind" | "tooling" | "topic";

export type RepositoryLabel = {
  id: string;
  kind: LabelKind;
  /** Why the label applies, e.g. "dependency react" or "62% of source files". */
  evidence: string;
  confidence: number;
};

type FrameworkRule = { label: string; match: RegExp; kind?: LabelKind };

// Matched against dependency names (npm, Python, Rust, Go, Java, .NET, PHP, Ruby).
const FRAMEWORKS: FrameworkRule[] = [
  { label: "react", match: /^react$/ },
  { label: "next.js", match: /^next$/ },
  { label: "vue", match: /^vue$|^nuxt$/ },
  { label: "svelte", match: /^svelte$|^@sveltejs\/kit$/ },
  { label: "angular", match: /^@angular\/core$/ },
  { label: "react native", match: /^react-native$|^expo$/ },
  { label: "electron", match: /^electron$/ },
  { label: "vite", match: /^vite$/, kind: "tooling" },
  { label: "fastify", match: /^fastify$/ },
  { label: "express", match: /^express$/ },
  { label: "nestjs", match: /^@nestjs\/core$/ },
  { label: "graphql", match: /^graphql$|^@apollo\/server$|^strawberry-graphql$|^graphene$/ },
  { label: "prisma", match: /^prisma$|^@prisma\/client$/ },
  { label: "django", match: /^django$/ },
  { label: "flask", match: /^flask$/ },
  { label: "fastapi", match: /^fastapi$/ },
  { label: "pytorch", match: /^torch$/ },
  { label: "tensorflow", match: /^tensorflow$/ },
  { label: "pandas", match: /^pandas$|^polars$/ },
  { label: "langchain", match: /^langchain/ },
  { label: "anthropic sdk", match: /^@anthropic-ai\/sdk$|^anthropic$/ },
  { label: "openai sdk", match: /^openai$/ },
  { label: "mcp", match: /^@modelcontextprotocol\/sdk$|^mcp$/ },
  { label: "spring", match: /^spring-boot|^org\.springframework/ },
  { label: "laravel", match: /^laravel\/framework$/ },
  { label: "rails", match: /^rails$/ },
  { label: "actix", match: /^actix-web$/ },
  { label: "axum", match: /^axum$/ },
  { label: "tokio", match: /^tokio$/ },
  { label: "gin", match: /gin-gonic\/gin$/ },
  { label: "asp.net core", match: /^Microsoft\.AspNetCore/ },
  { label: "entity framework", match: /^Microsoft\.EntityFrameworkCore/ },
  { label: "tailwind", match: /^tailwindcss$/, kind: "tooling" },
  { label: "mui", match: /^@mui\/material$/ },
  { label: "jest", match: /^jest$/, kind: "tooling" },
  { label: "vitest", match: /^vitest$/, kind: "tooling" },
  { label: "playwright", match: /^@playwright\/test$|^playwright$/, kind: "tooling" },
  { label: "pytest", match: /^pytest$/, kind: "tooling" }
];

const WEB_UI = new Set(["react", "next.js", "vue", "svelte", "angular"]);
const API = new Set(["fastify", "express", "nestjs", "django", "flask", "fastapi", "spring", "laravel", "rails", "actix", "axum", "gin", "asp.net core"]);
const ML = new Set(["pytorch", "tensorflow", "pandas", "langchain"]);

const has = (files: readonly string[], pattern: RegExp) => files.some((file) => pattern.test(file));

export function deriveLabels(docs: RepositoryDocuments): RepositoryLabel[] {
  const labels = new Map<string, RepositoryLabel>();
  const add = (label: RepositoryLabel) => {
    const existing = labels.get(label.id);
    if (!existing || existing.confidence < label.confidence) labels.set(label.id, label);
  };

  // Languages: the leading ones by share of recognised source files, Markdown excluded.
  const code = docs.languages.filter((language) => language.name !== "Markdown");
  const codeTotal = code.reduce((sum, language) => sum + language.share, 0) || 1;
  for (const language of code.slice(0, 3)) {
    const share = language.share / codeTotal;
    if (share >= 0.15) add({ id: language.name.toLowerCase(), kind: "language", evidence: `${Math.round(share * 100)}% of source files`, confidence: Math.min(1, 0.5 + share) });
  }

  const dependencies = docs.manifests.flatMap((manifest) => manifest.dependencies);
  const frameworks = new Set<string>();
  for (const rule of FRAMEWORKS) {
    const dependency = dependencies.find((name) => rule.match.test(name));
    if (dependency) {
      frameworks.add(rule.label);
      add({ id: rule.label, kind: rule.kind ?? "framework", evidence: `dependency ${dependency}`, confidence: 0.95 });
    }
  }

  const files = docs.files;
  if (has(files, /(^|\/)Dockerfile$|(^|\/)(docker-)?compose\.ya?ml$/)) add({ id: "docker", kind: "tooling", evidence: docs.composeServices.length ? `Compose services: ${docs.composeServices.slice(0, 4).join(", ")}` : "Dockerfile", confidence: 0.95 });
  if (has(files, /^\.github\/workflows\/[^/]+\.ya?ml$/)) add({ id: "github actions", kind: "tooling", evidence: ".github/workflows", confidence: 0.95 });
  if (has(files, /^\.gitlab-ci\.yml$/)) add({ id: "gitlab ci", kind: "tooling", evidence: ".gitlab-ci.yml", confidence: 0.95 });
  if (has(files, /\.tf$/)) add({ id: "terraform", kind: "tooling", evidence: "Terraform files", confidence: 0.9 });
  if (has(files, /(^|\/)(k8s|kubernetes|helm|charts)\//)) add({ id: "kubernetes", kind: "tooling", evidence: "Kubernetes manifests", confidence: 0.8 });
  const testFiles = files.filter((file) => /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[a-z]+$|_test\.(go|py)$|^test_.*\.py$/.test(file)).length;
  if (testFiles) add({ id: "tests", kind: "tooling", evidence: `${testFiles} test file${testFiles === 1 ? "" : "s"}`, confidence: Math.min(0.95, 0.6 + testFiles / 50) });

  // What the repository is, from the strongest available signal.
  const npmRoot = docs.manifests.find((manifest) => manifest.kind === "npm" && !manifest.path.includes("/"));
  if (npmRoot?.flags.workspaces || docs.manifests.filter((manifest) => manifest.path.includes("/")).length >= 2) add({ id: "monorepo", kind: "kind", evidence: npmRoot?.flags.workspaces ? "npm workspaces" : "several nested manifests", confidence: 0.85 });
  if (npmRoot?.flags.bin) add({ id: "cli", kind: "kind", evidence: "package.json bin", confidence: 0.9 });
  if ([...frameworks].some((name) => WEB_UI.has(name))) add({ id: "web app", kind: "kind", evidence: [...frameworks].filter((name) => WEB_UI.has(name)).join(", "), confidence: 0.85 });
  if ([...frameworks].some((name) => API.has(name))) add({ id: "api", kind: "kind", evidence: [...frameworks].filter((name) => API.has(name)).join(", "), confidence: 0.85 });
  if (frameworks.has("react native") || has(files, /(^|\/)pubspec\.yaml$|(^|\/)AndroidManifest\.xml$|\.xcodeproj\//)) add({ id: "mobile", kind: "kind", evidence: frameworks.has("react native") ? "react native" : "mobile project files", confidence: 0.85 });
  if ([...frameworks].some((name) => ML.has(name))) add({ id: "data & ml", kind: "kind", evidence: [...frameworks].filter((name) => ML.has(name)).join(", "), confidence: 0.8 });
  if (npmRoot && !npmRoot.flags.private && !npmRoot.flags.bin && !labels.has("web app") && !labels.has("api")) add({ id: "library", kind: "kind", evidence: "published npm package", confidence: 0.6 });
  const markdownShare = docs.languages.find((language) => language.name === "Markdown")?.share ?? 0;
  if (markdownShare >= 0.6) add({ id: "documentation", kind: "kind", evidence: `${Math.round(markdownShare * 100)}% Markdown`, confidence: 0.8 });
  if (labels.has("terraform") || labels.has("kubernetes")) add({ id: "infrastructure", kind: "kind", evidence: labels.has("terraform") ? "Terraform" : "Kubernetes", confidence: 0.8 });

  return [...labels.values()].sort((a, b) => kindOrder(a.kind) - kindOrder(b.kind) || b.confidence - a.confidence);
}

function kindOrder(kind: LabelKind): number {
  return ["kind", "language", "framework", "topic", "tooling"].indexOf(kind);
}

// Topics are matched by meaning, not keywords: each is described in a sentence and compared
// with the repository's summary embedding. Only used when an embedding provider is present.
export const TOPICS: Array<{ id: string; description: string }> = [
  { id: "payments", description: "Payments, billing, invoices, subscriptions, checkout and pricing." },
  { id: "authentication", description: "Authentication, login, users, sessions, OAuth, tokens and permissions." },
  { id: "e-commerce", description: "An online shop: products, catalog, cart, orders and checkout." },
  { id: "analytics", description: "Analytics, metrics, dashboards, reporting and charts." },
  { id: "messaging", description: "Notifications, email, chat, queues and real-time messaging." },
  { id: "developer tools", description: "Developer tooling: CLIs, build tools, linters, editors and automation for programmers." },
  { id: "ai agents", description: "AI agents, large language models, prompts, embeddings and retrieval." },
  { id: "design system", description: "A design system or component library: UI components, tokens, themes and icons." },
  { id: "documentation site", description: "A documentation website, guides, tutorials and knowledge base." },
  { id: "iot & devices", description: "Connected devices, IoT, sensors, telemetry, GPS tracking and embedded firmware." },
  { id: "infrastructure", description: "Infrastructure as code, deployment, containers, Kubernetes and cloud resources." },
  { id: "mobile app", description: "A mobile application for iOS or Android." }
];
