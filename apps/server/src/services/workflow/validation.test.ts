import assert from "node:assert/strict";
import test from "node:test";
import type {
  WorkflowDefinition,
  WorkflowNode
} from "./types.js";
import {
  getExecutableWorkflowNodes,
  WorkflowDefinitionValidationError
} from "./validation.js";

test("returns the exact connected workflow order", () => {
  const nodes = [
    createNode("trigger", "trigger.manual"),
    createNode("repositories", "repository.select", { mode: "all" }),
    createNode("fetch", "git.fetch"),
    createNode("summary", "output.summary")
  ];
  const workflow = createWorkflow(nodes, [
    { id: "one", source: "trigger", target: "repositories" },
    { id: "two", source: "repositories", target: "fetch" },
    { id: "three", source: "fetch", target: "summary" }
  ]);

  assert.deepEqual(
    getExecutableWorkflowNodes(workflow).map((node) => node.id),
    ["trigger", "repositories", "fetch", "summary"]
  );
});

test("rejects disconnected nodes instead of executing them by position", () => {
  const workflow = createWorkflow(
    [
      createNode("trigger", "trigger.manual"),
      createNode("fetch", "git.fetch"),
      createNode("push", "git.push")
    ],
    [{ id: "one", source: "trigger", target: "fetch" }]
  );

  assert.throws(
    () => getExecutableWorkflowNodes(workflow),
    (error: unknown) => (
      error instanceof WorkflowDefinitionValidationError
      && /disconnected: "push"/.test(error.message)
    )
  );
});

test("rejects workflows that cannot perform useful work", () => {
  const noActionWorkflow = createWorkflow(
    [createNode("trigger", "trigger.manual"), createNode("summary", "output.summary")],
    [{ id: "one", source: "trigger", target: "summary" }]
  );
  const emptySelectionWorkflow = createWorkflow(
    [
      createNode("trigger", "trigger.manual"),
      createNode("repositories", "repository.select", { mode: "manual", projectIds: [] }),
      createNode("fetch", "git.fetch")
    ],
    [
      { id: "one", source: "trigger", target: "repositories" },
      { id: "two", source: "repositories", target: "fetch" }
    ]
  );

  assert.throws(() => getExecutableWorkflowNodes(noActionWorkflow), /add at least one Git, Docker or terminal action/);
  assert.throws(() => getExecutableWorkflowNodes(emptySelectionWorkflow), /empty manual selection/);
});

function createWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowDefinition["edges"]
): WorkflowDefinition {
  return {
    id: "workflow",
    name: "Workflow",
    description: "",
    active: true,
    nodes,
    edges,
    createdAt: "2026-07-24T00:00:00.000Z",
    updatedAt: "2026-07-24T00:00:00.000Z"
  };
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
