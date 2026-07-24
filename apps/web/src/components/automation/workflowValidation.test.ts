import { describe, expect, it } from "vitest";
import type {
  WorkflowEdge,
  WorkflowNode
} from "../../types/workflows";
import { validateWorkflow } from "./workflowValidation";

describe("workflow validation", () => {
  it("recognizes a connected runnable workflow", () => {
    const nodes = [
      createNode("trigger", "trigger.manual"),
      createNode("repositories", "repository.select", { mode: "all" }),
      createNode("fetch", "git.fetch"),
      createNode("summary", "output.summary")
    ];
    const result = validateWorkflow(nodes, connect(nodes));

    expect(result.isRunnable).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.orderedNodeIds).toEqual(["trigger", "repositories", "fetch", "summary"]);
  });

  it("explains disconnected and incomplete workflows", () => {
    const nodes = [
      createNode("trigger", "trigger.manual"),
      createNode("terminal", "terminal.command", { command: "" }),
      createNode("push", "git.push")
    ];
    const result = validateWorkflow(nodes, [{ id: "one", source: "trigger", target: "terminal" }]);

    expect(result.isRunnable).toBe(false);
    expect(result.errors.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      "Configura il comando nel nodo “terminal”.",
      "Collega all'avvio “push”."
    ]));
  });

  it("blocks empty manual selections and warns when all repositories are implicit", () => {
    const manualNodes = [
      createNode("trigger", "trigger.manual"),
      createNode("repositories", "repository.select", { mode: "manual", projectIds: [] }),
      createNode("fetch", "git.fetch")
    ];
    const allRepositoriesNodes = [
      createNode("trigger", "trigger.manual"),
      createNode("fetch", "git.fetch"),
      createNode("summary", "output.summary")
    ];

    expect(validateWorkflow(manualNodes, connect(manualNodes)).errors[0]?.message).toContain("almeno un repository");
    expect(validateWorkflow(allRepositoriesNodes, connect(allRepositoriesNodes)).warnings[0]?.message).toContain("tutti i repository");
  });
});

function connect(nodes: WorkflowNode[]): WorkflowEdge[] {
  return nodes.slice(0, -1).map((node, index) => ({
    id: `${node.id}-${nodes[index + 1]?.id}`,
    source: node.id,
    target: nodes[index + 1]!.id
  }));
}

function createNode(
  id: string,
  type: WorkflowNode["type"],
  config: Record<string, unknown> = {}
): WorkflowNode {
  return {
    id,
    type,
    name: id,
    position: { x: 0, y: 0 },
    config
  };
}
