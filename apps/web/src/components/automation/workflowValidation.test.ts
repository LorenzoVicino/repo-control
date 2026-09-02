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
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "commandRequired", values: { name: "terminal" } }),
      expect.objectContaining({ code: "disconnectedNodes", values: { names: "“push”" } })
    ]));
  });

  it("requires a branch on the pull node and refuses one that reads as a flag", () => {
    const build = (branch: unknown) => {
      const nodes = [
        createNode("trigger", "trigger.manual"),
        createNode("repositories", "repository.select", { mode: "all" }),
        createNode("pull", "git.pullBranch", { branch, requireClean: true }),
        createNode("summary", "output.summary")
      ];
      return validateWorkflow(nodes, connect(nodes));
    };

    expect(build("develop").errors).toEqual([]);
    expect(build("release/2026.09").errors).toEqual([]);
    expect(build("").errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "branchRequired", values: { name: "pull" } })
    ]));
    // The branch becomes a git argument, so a leading dash would be read as a flag.
    expect(build("--upload-pack=whoami").errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "branchInvalid" })
    ]));
    expect(build("feature/../etc").errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "branchInvalid" })
    ]));
  });

  it("reports a fork once, without also listing the nodes it made unreachable", () => {
    const nodes = [
      createNode("trigger", "trigger.manual"),
      createNode("fetch", "git.fetch"),
      createNode("push", "git.push")
    ];
    const result = validateWorkflow(nodes, [
      { id: "one", source: "trigger", target: "fetch" },
      { id: "two", source: "trigger", target: "push" }
    ]);

    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "multipleOutputs", values: { name: "trigger" } })
    ]));
    // The unreachable nodes are the consequence of the fork, not a second mistake.
    expect(result.errors.map((issue) => issue.code)).not.toContain("disconnectedNodes");
    expect(result.errors.map((issue) => issue.code)).not.toContain("disconnectedNodesMore");
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

    expect(validateWorkflow(manualNodes, connect(manualNodes)).errors[0]).toMatchObject({
      code: "repositorySelectionRequired"
    });
    expect(validateWorkflow(allRepositoriesNodes, connect(allRepositoriesNodes)).warnings[0]).toMatchObject({
      code: "noRepositorySelectWarning"
    });
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
