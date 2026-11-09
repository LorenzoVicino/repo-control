import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWorkspaceGraph } from "../../api/knowledge";
import { renderWithProviders } from "../../test/render";
import type { WorkspaceGraph } from "../../types/graph";
import { GraphPage } from "./GraphPage";

vi.mock("../../api/knowledge", () => ({ fetchWorkspaceGraph: vi.fn() }));

// sigma needs WebGL, which jsdom lacks: the canvas is replaced by a stand-in that exposes
// what the page passes it and lets the test click nodes or report WebGL as missing.
vi.mock("./GraphCanvas", () => ({
  GraphCanvas: (props: { graph: { order: number }; visibleEdges: Set<string>; showLabels: boolean; selected: string | null; onSelect: (id: string | null) => void; onUnavailable: () => void; ariaLabel: string }) => (
    <div role="img" aria-label={props.ariaLabel} data-order={props.graph.order} data-edges={[...props.visibleEdges].sort().join(",")} data-labels={String(props.showLabels)} data-selected={props.selected ?? ""}>
      <button onClick={() => props.onSelect("s")}>click shared-utils</button>
      <button onClick={() => props.onSelect("label:kind:library")}>click library label</button>
      <button onClick={() => props.onUnavailable()}>lose webgl</button>
    </div>
  )
}));

const graph: WorkspaceGraph = {
  nodes: [
    { id: "a", type: "repository", name: "atlas-api", relativePath: "atlas-api", kind: "api", labels: ["api"] },
    { id: "s", type: "repository", name: "shared-utils", relativePath: "shared-utils", kind: "library", labels: ["library"] },
    { id: "label:kind:library", type: "label", name: "library", labelKind: "kind", count: 1 }
  ],
  edges: [
    { source: "a", target: "s", type: "depends_on", weight: 3, evidence: ["depends on @acme/shared-utils"] },
    { source: "s", target: "label:kind:library", type: "labelled", weight: 1, evidence: ["published npm package"] }
  ]
};

describe("GraphPage", () => {
  beforeEach(() => vi.mocked(fetchWorkspaceGraph).mockResolvedValue(graph));

  it("draws the graph, filters relations and shows a repository's relations", async () => {
    const onOpenProject = vi.fn();
    const onAskAgent = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<GraphPage onOpenProject={onOpenProject} onAskAgent={onAskAgent} />);

    const canvas = await screen.findByRole("img", { name: "Graph of 2 repositories and their relations" });
    expect(canvas).toHaveAttribute("data-order", "3");
    expect(screen.getByText("2 repositories and 1 relations: dependencies, mentions and shared labels.")).toBeVisible();
    expect(screen.getByRole("button", { name: /Similar meaning · 0/ })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Enable semantic search in Knowledge to link repositories by meaning.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Dependencies · 1/ }));
    expect(canvas).toHaveAttribute("data-edges", "labelled,references,similar");
    await user.click(screen.getByRole("button", { name: "Label nodes" }));
    expect(canvas).toHaveAttribute("data-labels", "false");

    await user.click(within(canvas).getByRole("button", { name: "click shared-utils" }));
    const panel = screen.getByRole("complementary", { name: "Relations of shared-utils" });
    expect(within(panel).getByText("Used by · 1")).toBeVisible();
    expect(within(panel).getByText("depends on @acme/shared-utils")).toBeVisible();
    await user.click(within(panel).getByRole("button", { name: "Open repository" }));
    expect(onOpenProject).toHaveBeenCalledWith("s");
    await user.click(within(panel).getByRole("button", { name: "Ask the agent" }));
    expect(onAskAgent).toHaveBeenCalledWith(expect.stringMatching(/^What would a change to shared-utils affect\?/));

    await user.click(within(panel).getByRole("button", { name: "atlas-api" }));
    expect(screen.getByRole("complementary", { name: "Relations of atlas-api" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("finds a repository by name and explains label nodes", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GraphPage onOpenProject={vi.fn()} onAskAgent={vi.fn()} />);
    const canvas = await screen.findByRole("img", { name: /Graph of 2/ });

    await user.type(screen.getByRole("textbox", { name: "Find a repository" }), "atl");
    await user.click(within(screen.getByRole("listbox", { name: "Matching repositories" })).getByRole("option", { name: "atlas-api" }));
    expect(canvas).toHaveAttribute("data-selected", "a");
    expect(screen.getByRole("textbox", { name: "Find a repository" })).toHaveValue("");

    await user.type(screen.getByRole("textbox", { name: "Find a repository" }), "shared{Enter}");
    expect(canvas).toHaveAttribute("data-selected", "s");

    await user.click(within(canvas).getByRole("button", { name: "click library label" }));
    const panel = screen.getByRole("complementary", { name: "Relations of library" });
    expect(within(panel).getByText("Kind")).toBeVisible();
    expect(within(panel).getByText("1 repository · 1")).toBeVisible();
  });

  it("keeps search and relations working when WebGL is unavailable", async () => {
    const user = userEvent.setup();
    renderWithProviders(<GraphPage onOpenProject={vi.fn()} onAskAgent={vi.fn()} />);
    await user.click(within(await screen.findByRole("img", { name: /Graph of 2/ })).getByRole("button", { name: "lose webgl" }));
    expect(screen.getByText(/WebGL is unavailable/)).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "Find a repository" }), "shared{Enter}");
    expect(screen.getByRole("complementary", { name: "Relations of shared-utils" })).toBeVisible();
  });
});
