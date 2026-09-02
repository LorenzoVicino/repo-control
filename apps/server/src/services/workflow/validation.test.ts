import assert from "node:assert/strict";
import test from "node:test";
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowNodeType
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

// The web editor keeps its own copy of these rules so it can validate without a round trip,
// which means a node type added on one side only is the realistic way for the two to drift.
// This pins the server's own contract: every type is either an action or structural, and a
// new one has to be classified here before it can be added at all.
test("classifies every node type as an action or as structure", () => {
  const structuralNodeTypes: WorkflowNodeType[] = [
    "trigger.manual",
    "input.text",
    "repository.select",
    "repository.filter",
    "output.summary"
  ];
  const actionNodeTypes: WorkflowNodeType[] = [
    "git.fetch",
    "git.pull",
    "git.pullBranch",
    "git.push",
    "docker.up",
    "docker.rebuild",
    "docker.stop",
    "terminal.command"
  ];

  for (const type of actionNodeTypes) {
    const workflow = createWorkflow(
      [
        createNode("trigger", "trigger.manual"),
        createNode("action", type, type === "terminal.command" ? { command: "echo hi" } : { branch: "develop" })
      ],
      [{ id: "edge", source: "trigger", target: "action" }]
    );

    // An action node satisfies "add at least one Git, Docker or terminal action".
    assert.doesNotThrow(() => getExecutableWorkflowNodes(workflow), `${type} should count as an action`);
  }

  for (const type of structuralNodeTypes.filter((candidate) => candidate !== "trigger.manual")) {
    const workflow = createWorkflow(
      [
        createNode("trigger", "trigger.manual"),
        createNode("structural", type, type === "input.text" ? { key: "value" } : { mode: "all" })
      ],
      [{ id: "edge", source: "trigger", target: "structural" }]
    );

    assert.throws(
      () => getExecutableWorkflowNodes(workflow),
      /add at least one Git, Docker or terminal action/,
      `${type} should not count as an action`
    );
  }

  assert.equal(structuralNodeTypes.length + actionNodeTypes.length, 13);
});
