import type { KnowledgeHit, KnowledgeRepository, KnowledgeStatus, RepositoryLabel } from "../types/knowledge";
import type { ProjectSummary } from "../types/projects";

// The online demo's knowledge index: fixed labels and summaries for the fictional workspace,
// and a small keyword search over them that produces the same shapes and highlights as the
// real index. There is no semantic search in the demo.

const label = (id: string, kind: RepositoryLabel["kind"], evidence: string): RepositoryLabel => ({ id, kind, evidence, confidence: 0.9 });

const PROFILES: Record<string, { labels: RepositoryLabel[]; summary: string; readme: string }> = {
  "atlas-api": {
    labels: [label("api", "kind", "fastify"), label("typescript", "language", "91% of source files"), label("fastify", "framework", "dependency fastify"), label("prisma", "framework", "dependency @prisma/client"), label("docker", "tooling", "Compose services: api, db"), label("tests", "tooling", "38 test files")],
    summary: "atlas-api: Orders and catalog API for the Atlas shop.\nKind: api.\nLanguages: typescript.\nFrameworks: fastify, prisma.\nTooling: docker, tests.\nDocker Compose services: api, db.",
    readme: "Atlas API serves orders, products and checkout for the shop. It talks to billing-worker to issue invoices after payment."
  },
  "atlas-web": {
    labels: [label("web app", "kind", "react"), label("typescript", "language", "88% of source files"), label("react", "framework", "dependency react"), label("vite", "tooling", "dependency vite"), label("tests", "tooling", "21 test files")],
    summary: "atlas-web: Storefront and checkout for the Atlas shop.\nKind: web app.\nLanguages: typescript.\nFrameworks: react.\nTooling: vite, tests.",
    readme: "The Atlas storefront: product pages, cart and checkout, built with React and Vite. It calls atlas-api for orders."
  },
  "design-system": {
    labels: [label("library", "kind", "published npm package"), label("typescript", "language", "84% of source files"), label("react", "framework", "dependency react"), label("tests", "tooling", "56 test files")],
    summary: "design-system: Shared React components, tokens and icons.\nKind: library.\nLanguages: typescript.\nFrameworks: react.",
    readme: "Buttons, forms, colour tokens and icons shared by atlas-web and mobile-client. Every component ships with stories and tests."
  },
  documentation: {
    labels: [label("documentation", "kind", "92% Markdown"), label("github actions", "tooling", ".github/workflows")],
    summary: "documentation: Product and engineering handbook.\nKind: documentation.\nTooling: github actions.",
    readme: "Guides for onboarding, the deployment checklist, incident runbooks and the architecture of the Atlas platform."
  },
  "billing-worker": {
    labels: [label("api", "kind", "fastapi"), label("python", "language", "100% of source files"), label("fastapi", "framework", "dependency fastapi"), label("docker", "tooling", "Compose services: worker, redis"), label("tests", "tooling", "17 test files")],
    summary: "billing-worker: Generates invoices and handles payment webhooks.\nKind: api.\nLanguages: python.\nFrameworks: fastapi.\nTooling: docker, tests.",
    readme: "Billing worker generates monthly invoices, retries failed payments and receives payment provider webhooks."
  },
  "mobile-client": {
    labels: [label("mobile", "kind", "react native"), label("typescript", "language", "79% of source files"), label("react native", "framework", "dependency react-native")],
    summary: "mobile-client: The Atlas shop app for iOS and Android.\nKind: mobile.\nLanguages: typescript.\nFrameworks: react native.",
    readme: "The Atlas mobile app: browse products, track orders and receive push notifications."
  },
  "shared-utils": {
    labels: [label("library", "kind", "published npm package"), label("typescript", "language", "100% of source files"), label("tests", "tooling", "12 test files")],
    summary: "shared-utils: Date, money and validation helpers.\nKind: library.\nLanguages: typescript.",
    readme: "Small helpers shared across the Atlas repositories: money formatting, date ranges and input validation."
  }
};

export function demoKnowledgeRepositories(projects: readonly ProjectSummary[]): KnowledgeRepository[] {
  return projects.map((project) => {
    const profile = PROFILES[project.name] ?? { labels: [], summary: `${project.name}.`, readme: "" };
    return { id: project.id, name: project.name, relativePath: project.name, labels: profile.labels, summary: profile.summary, indexedAt: "2026-01-15T10:00:00.000Z" };
  });
}

export function demoKnowledgeStatus(projects: readonly ProjectSummary[]): KnowledgeStatus {
  return {
    state: "idle",
    root: "C:\\Users\\Alex\\Projects",
    indexed: projects.length,
    total: projects.length,
    progress: null,
    lastRun: { startedAt: new Date(Date.now() - 120_000).toISOString(), finishedAt: new Date(Date.now() - 118_000).toISOString(), updated: projects.length, skipped: 0, removed: 0, failed: [] },
    semantic: { enabled: false, model: null, installable: false, install: { state: "idle", message: null } }
  };
}

function highlight(text: string, words: readonly string[]): string | null {
  const pattern = new RegExp(`(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return pattern.test(text) ? text.replace(pattern, "«$1»") : null;
}

export function demoKnowledgeSearch(projects: readonly ProjectSummary[], query: string): KnowledgeHit[] {
  const words = (query.toLowerCase().match(/[\p{L}\p{N}_.-]+/gu) ?? []).filter((word) => word.length > 1);
  if (!words.length) return [];
  return demoKnowledgeRepositories(projects)
    .map((repository) => {
      const profile = PROFILES[repository.name];
      const matches = [
        profile && highlight(profile.readme, words) ? { path: "README.md", kind: "readme" as const, snippet: highlight(profile.readme, words)! } : null,
        highlight(repository.summary.replace(/\n/g, " "), words) ? { path: "", kind: "summary" as const, snippet: highlight(repository.summary.replace(/\n/g, " "), words)! } : null
      ].filter((match): match is NonNullable<typeof match> => match !== null);
      const labelHit = repository.labels.some((item) => words.includes(item.id));
      const via: KnowledgeHit["via"] = [...(matches.length ? (["text"] as const) : []), ...(labelHit ? (["label"] as const) : [])];
      return { id: repository.id, name: repository.name, relativePath: repository.relativePath, labels: repository.labels, score: matches.length + (labelHit ? 1 : 0), via, matches };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
