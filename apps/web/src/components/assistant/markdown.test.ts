import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./markdown";

describe("parseMarkdown", () => {
  it("reads the block structure Claude uses in short answers", () => {
    const source = [
      "## Triage",
      "Two repositories need you.",
      "This line joins the paragraph.",
      "",
      "- **atlas-api**: 3 files",
      "  wrapped continuation",
      "- docs: clean",
      "",
      "1. Pull docs",
      "2) Push design",
      "",
      "| Repo | State |",
      "| --- | :---: |",
      "| atlas | dirty |",
      "",
      "```bash",
      "git pull --ff-only",
      "```"
    ].join("\n");

    expect(parseMarkdown(source)).toEqual([
      { type: "heading", text: "Triage" },
      { type: "paragraph", text: "Two repositories need you. This line joins the paragraph." },
      { type: "list", ordered: false, items: ["**atlas-api**: 3 files wrapped continuation", "docs: clean"] },
      { type: "list", ordered: true, items: ["Pull docs", "Push design"] },
      { type: "table", header: ["Repo", "State"], rows: [["atlas", "dirty"]] },
      { type: "code", text: "git pull --ff-only" }
    ]);
  });

  it("keeps an unterminated code fence and treats raw HTML as text", () => {
    expect(parseMarkdown("```\nopen")).toEqual([{ type: "code", text: "open" }]);
    expect(parseMarkdown("<img src=x onerror=alert(1)>")).toEqual([{ type: "paragraph", text: "<img src=x onerror=alert(1)>" }]);
  });
});
