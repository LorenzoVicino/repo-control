import { describe, expect, it } from "vitest";
import i18n from "../../i18n";
import type { WorkflowNode, WorkflowNodeType } from "../../types/workflows";
import {
  AUTOMATION_NODE_DEFINITIONS,
  AUTOMATION_NODE_GROUPS,
  getAutomationNodeDescription,
  getAutomationNodeLabel,
  getAutomationNodeSummary
} from "./automationNodeCatalog";

// Kept as an explicit list rather than derived from the catalog: adding a node type to the
// contract without giving it a palette entry, a label and a description should fail here
// rather than surface as an unnamed block in the editor.
const NODE_TYPES: WorkflowNodeType[] = [
  "trigger.manual",
  "input.text",
  "repository.select",
  "repository.filter",
  "git.fetch",
  "git.pull",
  "git.pullBranch",
  "git.push",
  "docker.up",
  "docker.rebuild",
  "docker.stop",
  "terminal.command",
  "output.summary"
];

function node(type: WorkflowNodeType, config: Record<string, unknown> = {}): WorkflowNode {
  return { id: "node", type, name: type, position: { x: 0, y: 0 }, config };
}

describe("automation node catalog", () => {
  it("describes every node type in both languages", () => {
    expect(AUTOMATION_NODE_DEFINITIONS.map((definition) => definition.type).sort()).toEqual(
      [...NODE_TYPES].sort()
    );

    for (const language of ["en", "it"] as const) {
      const t = i18n.getFixedT(language);

      for (const type of NODE_TYPES) {
        // A missing key resolves to the key itself, which is how an untranslated block
        // reaches the palette unnoticed.
        expect(getAutomationNodeLabel(t, type)).not.toContain("automation.nodeTypes");
        expect(getAutomationNodeDescription(t, type)).not.toContain("automation.nodeTypes");
      }
    }
  });

  it("groups every node under a known palette group", () => {
    for (const definition of AUTOMATION_NODE_DEFINITIONS) {
      expect(AUTOMATION_NODE_GROUPS).toContain(definition.group);
    }
  });

  it("summarizes the configurable pull by branch and cleanliness", () => {
    const t = i18n.getFixedT("en");

    expect(getAutomationNodeSummary(t, node("git.pullBranch", { branch: "develop" })))
      .toBe("origin/develop · clean only");
    expect(getAutomationNodeSummary(t, node("git.pullBranch", { branch: "main", requireClean: false })))
      .toBe("origin/main · local changes allowed");
    expect(getAutomationNodeSummary(t, node("git.pullBranch", {})))
      .toBe("Branch not configured");
  });
});
