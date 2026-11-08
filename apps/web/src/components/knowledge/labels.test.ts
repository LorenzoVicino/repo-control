import { describe, expect, it } from "vitest";
import type { KnowledgeRepository } from "../../types/knowledge";
import { countLabels, splitHighlights } from "./labels";

const repository = (id: string, labels: Array<[string, KnowledgeRepository["labels"][number]["kind"]]>): KnowledgeRepository => ({
  id,
  name: id,
  relativePath: id,
  summary: id,
  indexedAt: "2026-11-09T00:00:00.000Z",
  labels: labels.map(([labelId, kind]) => ({ id: labelId, kind, evidence: "x", confidence: 1 }))
});

describe("knowledge label helpers", () => {
  it("counts labels across repositories, grouped by kind in display order", () => {
    const grouped = countLabels([
      repository("a", [["api", "kind"], ["typescript", "language"], ["docker", "tooling"]]),
      repository("b", [["api", "kind"], ["python", "language"]]),
      repository("c", [["typescript", "language"], ["payments", "topic"]])
    ]);
    expect([...grouped.keys()]).toEqual(["kind", "language", "topic", "tooling"]);
    expect(grouped.get("language")).toEqual([
      { id: "typescript", kind: "language", count: 2 },
      { id: "python", kind: "language", count: 1 }
    ]);
  });

  it("splits a snippet on its match markers", () => {
    expect(splitHighlights("…the «MCP» «server» that")).toEqual([
      { text: "…the ", match: false },
      { text: "MCP", match: true },
      { text: " ", match: false },
      { text: "server", match: true },
      { text: " that", match: false }
    ]);
    expect(splitHighlights("plain")).toEqual([{ text: "plain", match: false }]);
  });
});
