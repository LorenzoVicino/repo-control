import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../test/render";
import { AgentSessionsPage } from "./AgentSessionsPage";

describe("AgentSessionsPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows detected histories, filters providers and resumes the selected session", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        root: "/workspace",
        agents: [
          {
            id: "claude",
            label: "Claude Code",
            installed: true,
            used: true,
            command: "claude",
            sessionCount: 1
          },
          {
            id: "codex",
            label: "Codex",
            installed: true,
            used: true,
            command: "codex",
            sessionCount: 1
          },
          {
            id: "gemini",
            label: "Gemini CLI",
            installed: false,
            used: false,
            command: "gemini",
            sessionCount: 0
          }
        ],
        sessions: [
          {
            id: "codex-session",
            provider: "codex",
            providerLabel: "Codex",
            projectId: "api-id",
            projectName: "api",
            projectPath: "/workspace/api",
            title: "Aggiungi rate limiting",
            preview: "Aggiungi rate limiting",
            branch: "main",
            startedAt: "2026-07-29T08:00:00.000Z",
            updatedAt: "2026-07-29T09:00:00.000Z",
            match: null
          },
          {
            id: "claude-session",
            provider: "claude",
            providerLabel: "Claude Code",
            projectId: "shop-id",
            projectName: "shop",
            projectPath: "/workspace/shop",
            title: "Correggi il checkout",
            preview: "Correggi il checkout",
            branch: "feature/checkout",
            startedAt: "2026-07-30T08:00:00.000Z",
            updatedAt: "2026-07-30T09:00:00.000Z",
            match: null
          }
        ],
        scannedAt: "2026-07-30T10:00:00.000Z",
        warnings: []
      }))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        message: "Terminale aperto",
        command: "codex resume codex-session"
      }));
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity }
      }
    });

    renderWithTheme(
      <QueryClientProvider client={queryClient}>
        <AgentSessionsPage />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Correggi il checkout")).toBeVisible();
    expect(screen.getByText("Aggiungi rate limiting")).toBeVisible();
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Correggi il checkout");

    await user.click(screen.getByRole("button", { name: /Filtra per Claude Code/ }));
    expect(screen.getByText("Correggi il checkout")).toBeVisible();
    expect(screen.queryByText("Aggiungi rate limiting")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Filtra per Claude Code/ }));
    expect(screen.getByText("Aggiungi rate limiting")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Filtra per Codex/ }));
    expect(screen.queryByText("Correggi il checkout")).not.toBeInTheDocument();
    expect(screen.getByText("Aggiungi rate limiting")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Resume" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1]).toEqual([
      "/api/agent-sessions/codex/codex-session/resume",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: "api-id" })
      }
    ]);
    expect(await screen.findByText("Terminale aperto")).toBeVisible();

    queryClient.clear();
  });

  it("searches full chat content and shows the matching fragment", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      return jsonResponse({
        root: "/workspace",
        agents: [
          {
            id: "claude",
            label: "Claude Code",
            installed: true,
            used: true,
            command: "claude",
            sessionCount: 1
          },
          {
            id: "codex",
            label: "Codex",
            installed: true,
            used: true,
            command: "codex",
            sessionCount: 1
          },
          {
            id: "gemini",
            label: "Gemini CLI",
            installed: false,
            used: false,
            command: "gemini",
            sessionCount: 0
          }
        ],
        sessions: url.includes("search=")
          ? [{
              id: "codex-session",
              provider: "codex",
              providerLabel: "Codex",
              projectId: "api-id",
              projectName: "api",
              projectPath: "/workspace/api",
              title: "Rendi robuste le API",
              preview: "Rendi robuste le API",
              branch: "main",
              startedAt: "2026-07-29T08:00:00.000Z",
              updatedAt: "2026-07-29T09:00:00.000Z",
              match: {
                field: "content",
                snippet: "Ho configurato il retry budget per le chiamate."
              }
            }]
          : [],
        scannedAt: "2026-07-30T10:00:00.000Z",
        warnings: []
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity }
      }
    });

    renderWithTheme(
      <QueryClientProvider client={queryClient}>
        <AgentSessionsPage />
      </QueryClientProvider>
    );

    const searchInput = await screen.findByRole("textbox", {
      name: "Search in chat titles and content"
    });
    await user.type(searchInput, "retry budget");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/agent-sessions?search=retry+budget",
        undefined
      );
    }, { timeout: 1500 });
    expect(await screen.findByText("In the chat")).toBeVisible();
    expect(screen.getByText(/Ho configurato il/)).toHaveTextContent(
      "Ho configurato il retry budget per le chiamate."
    );

    queryClient.clear();
  });
});

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload
  };
}
