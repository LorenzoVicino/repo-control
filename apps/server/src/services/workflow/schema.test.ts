import assert from "node:assert/strict";
import test from "node:test";
import {
  getDefaultWorkflows,
  normalizeWorkflowDefinition,
  normalizeWorkflowRun
} from "./schema.js";
import {
  getBoolean,
  getNullableString,
  getNumber,
  getString,
  getStringArray,
  isRecord
} from "./value.js";

test("normalizes malformed workflow definitions into safe defaults", () => {
  const fallback = normalizeWorkflowDefinition(null);
  const normalized = normalizeWorkflowDefinition({
    id: "workflow-1",
    name: `  ${"n".repeat(140)}  `,
    description: "description",
    active: true,
    nodes: [{
      id: "node-1",
      type: "unknown",
      name: "",
      position: { x: Number.NaN, y: 12 },
      config: null
    }],
    edges: [
      { source: "node-1", target: "node-2" },
      { source: "", target: "node-2" },
      null
    ]
  });

  assert.equal(fallback.nodes.length, 6);
  assert.equal(normalized.name.length, 120);
  assert.equal(normalized.active, true);
  assert.equal(normalized.nodes[0]?.type, "trigger.manual");
  assert.deepEqual(normalized.nodes[0]?.position, { x: 0, y: 12 });
  assert.deepEqual(normalized.nodes[0]?.config, {});
  assert.deepEqual(normalized.edges, [{
    id: "node-1->node-2",
    source: "node-1",
    target: "node-2"
  }]);
});

test("normalizes persisted workflow runs and rejects unusable records", () => {
  assert.equal(normalizeWorkflowRun(null), null);
  assert.equal(normalizeWorkflowRun({ workflowId: "", workflowName: "name" }), null);

  const run = normalizeWorkflowRun({
    id: "run-1",
    workflowId: "workflow-1",
    workflowName: "Workflow",
    mode: "dry-run",
    status: "failed",
    durationMs: 25,
    steps: [
      {
        id: "step-1",
        nodeId: "node-1",
        nodeName: "Fetch",
        nodeType: "git.fetch",
        status: "failed",
        projectId: "project-1",
        projectName: "Project",
        command: "git fetch",
        message: "failed",
        stdout: "out",
        stderr: "err",
        durationMs: 20
      },
      {
        nodeType: "invalid",
        status: "skipped"
      },
      null
    ]
  });

  assert.ok(run);
  assert.equal(run.mode, "dry-run");
  assert.equal(run.status, "failed");
  assert.equal(run.steps.length, 2);
  assert.equal(run.steps[1]?.nodeType, "trigger.manual");
  assert.deepEqual(run.summary, {
    selectedProjects: 0,
    succeeded: 0,
    failed: 1,
    skipped: 1,
    commands: 1
  });
  assert.equal(
    normalizeWorkflowRun({
      workflowId: "workflow-1",
      workflowName: "Workflow",
      status: "warning"
    })?.status,
    "warning"
  );
});

test("provides a connected default workflow", () => {
  const workflows = getDefaultWorkflows();

  assert.equal(workflows.length, 1);
  assert.equal(workflows[0]?.nodes.length, 6);
  assert.equal(workflows[0]?.edges.length, 5);
  assert.equal(workflows[0]?.edges[0]?.source, workflows[0]?.nodes[0]?.id);
});

test("preserves text input nodes during workflow normalization", () => {
  const workflow = normalizeWorkflowDefinition({
    id: "workflow-input",
    nodes: [
      {
        id: "release-name",
        type: "input.text",
        name: "Release name",
        position: { x: 120, y: 40 },
        config: { key: "release_name", required: true }
      }
    ]
  });

  assert.equal(workflow.nodes[0]?.type, "input.text");
  assert.deepEqual(workflow.nodes[0]?.config, {
    key: "release_name",
    required: true
  });
});

test("workflow value helpers reject values of the wrong shape", () => {
  assert.equal(getString(" value ", "fallback"), "value");
  assert.equal(getString(" ", "fallback"), "fallback");
  assert.equal(getNullableString(3), null);
  assert.deepEqual(getStringArray(["one", 2, "two"]), ["one", "two"]);
  assert.equal(getBoolean("true", false), false);
  assert.equal(getNumber(Number.POSITIVE_INFINITY, 4), 4);
  assert.equal(isRecord({ value: true }), true);
  assert.equal(isRecord([]), false);
});
