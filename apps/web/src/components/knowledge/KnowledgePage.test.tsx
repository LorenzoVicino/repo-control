import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { enableSemanticSearch, fetchKnowledgeRepositories, fetchKnowledgeStatus, reindexKnowledge, searchKnowledge } from "../../api/knowledge";
import { renderWithProviders } from "../../test/render";
import type { KnowledgeStatus } from "../../types/knowledge";
import { KnowledgePage } from "./KnowledgePage";

vi.mock("../../api/knowledge", () => ({
  fetchKnowledgeStatus: vi.fn(),
  reindexKnowledge: vi.fn(),
  enableSemanticSearch: vi.fn(),
  fetchKnowledgeRepositories: vi.fn(),
  searchKnowledge: vi.fn()
}));

function status(overrides: Partial<KnowledgeStatus> = {}): KnowledgeStatus {
  return {
    state: "idle",
    root: "/workspace",
    indexed: 2,
    total: 2,
    progress: null,
    lastRun: { startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), updated: 2, skipped: 0, removed: 0, failed: [] },
    semantic: { enabled: false, model: null, installable: true, install: { state: "idle", message: null } },
    ...overrides
  };
}

const repositories = [
  {
    id: "YXRsYXM",
    name: "atlas-api",
    relativePath: "atlas-api",
    summary: "atlas-api: Orders API.\nKind: api.",
    indexedAt: "2026-11-09T00:00:00.000Z",
    labels: [
      { id: "api", kind: "kind" as const, evidence: "fastify", confidence: 0.9 },
      { id: "fastify", kind: "framework" as const, evidence: "dependency fastify", confidence: 0.95 }
    ]
  },
  {
    id: "ZG9jcw",
    name: "docs",
    relativePath: "docs",
    summary: "docs.\nKind: documentation.",
    indexedAt: "2026-11-09T00:00:00.000Z",
    labels: [{ id: "documentation", kind: "kind" as const, evidence: "92% Markdown", confidence: 0.8 }]
  }
];

describe("KnowledgePage", () => {
  beforeEach(() => {
    vi.mocked(fetchKnowledgeStatus).mockResolvedValue(status());
    vi.mocked(fetchKnowledgeRepositories).mockResolvedValue({ repositories });
    vi.mocked(reindexKnowledge).mockResolvedValue(status({ state: "indexing", progress: { done: 0, total: 2 } }));
    vi.mocked(enableSemanticSearch).mockResolvedValue(status({ semantic: { enabled: false, model: null, installable: true, install: { state: "installing", message: null } } }));
  });

  it("shows labels by kind, filters repositories by a label and opens one", async () => {
    const onOpenProject = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<KnowledgePage onOpenProject={onOpenProject} />);

    expect(await screen.findByText(/^2 repositories indexed/)).toBeVisible();
    expect(screen.getByText("Full-text search")).toBeVisible();
    expect(await screen.findByRole("heading", { name: "2 repositories" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "fastify · 1" }));
    expect(screen.getByRole("heading", { name: "1 repository labelled fastify" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Open docs" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open atlas-api" }));
    expect(onOpenProject).toHaveBeenCalledWith("YXRsYXM");

    await user.click(screen.getByRole("button", { name: "Show all" }));
    expect(screen.getByRole("heading", { name: "2 repositories" })).toBeVisible();
  });

  it("searches with highlighted matches and how each repository matched", async () => {
    vi.mocked(searchKnowledge).mockResolvedValue({
      query: "orders",
      hits: [{ ...repositories[0], score: 0.1, via: ["text", "label"], matches: [{ path: "README.md", kind: "readme", snippet: "serves «orders» for the shop" }] }]
    });
    const user = userEvent.setup();
    renderWithProviders(<KnowledgePage onOpenProject={vi.fn()} />);

    await user.type(await screen.findByRole("textbox", { name: "Search the workspace" }), "orders");
    const results = await screen.findByRole("list", { name: "Repositories matching orders" });
    expect(searchKnowledge).toHaveBeenLastCalledWith("orders", expect.any(String));
    expect(within(results).getByText("orders").tagName).toBe("MARK");
    expect(within(results).getByText("README.md")).toBeVisible();
    expect(within(results).getByText("words")).toBeVisible();
    expect(within(results).getByText("label")).toBeVisible();

    vi.mocked(searchKnowledge).mockResolvedValue({ query: "zzz", hits: [] });
    await user.clear(screen.getByRole("textbox", { name: "Search the workspace" }));
    await user.type(screen.getByRole("textbox", { name: "Search the workspace" }), "zzz");
    expect(await screen.findByText('No repository matches "zzz".')).toBeVisible();
  });

  it("re-indexes on request, indexes an empty workspace on the first visit and enables semantic search", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchKnowledgeStatus).mockResolvedValueOnce(status({ indexed: 0, total: 0, lastRun: null }));
    renderWithProviders(<KnowledgePage onOpenProject={vi.fn()} />);

    await waitFor(() => expect(reindexKnowledge).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Indexing 0 of 2")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Indexing progress" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Re-index" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Enable semantic search" }));
    expect(enableSemanticSearch).toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Downloading and indexing…" })).toBeDisabled();
  });

  it("reports an enabled semantic model, a failed install and an installation that cannot install", async () => {
    vi.mocked(fetchKnowledgeStatus).mockResolvedValue(status({ semantic: { enabled: true, model: "transformers:Xenova/model", installable: true, install: { state: "idle", message: null } } }));
    const { unmount } = renderWithProviders(<KnowledgePage onOpenProject={vi.fn()} />);
    expect(await screen.findByText("Full-text + semantic")).toBeVisible();
    expect(screen.getByText("transformers:Xenova/model")).toBeVisible();
    unmount();

    vi.mocked(fetchKnowledgeStatus).mockResolvedValue(status({ semantic: { enabled: false, model: null, installable: true, install: { state: "failed", message: "npm ERR! network" } } }));
    const second = renderWithProviders(<KnowledgePage onOpenProject={vi.fn()} />);
    expect(await screen.findByText("npm ERR! network")).toBeVisible();
    second.unmount();

    vi.mocked(fetchKnowledgeStatus).mockResolvedValue(status({ semantic: { enabled: false, model: null, installable: false, install: { state: "idle", message: null } } }));
    renderWithProviders(<KnowledgePage onOpenProject={vi.fn()} />);
    expect(await screen.findByText(/Install @huggingface\/transformers/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Enable semantic search" })).not.toBeInTheDocument();
  });
});
