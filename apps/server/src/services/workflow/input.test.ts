import assert from "node:assert/strict";
import test from "node:test";
import {
  WorkflowInputValidationError,
  getWorkflowTextInputDefinitions,
  interpolateWorkflowInputReferences,
  resolveWorkflowInputs
} from "./input.js";
import type { WorkflowNode } from "./types.js";

test("resolves required and default workflow inputs without exposing values in commands", () => {
  const nodes = [
    createInputNode("message", "Release message", true, ""),
    createInputNode("channel", "Channel", false, "stable")
  ];

  const resolved = resolveWorkflowInputs(nodes, { message: "release candidate" });
  const command = interpolateWorkflowInputReferences(
    "publish --message {{inputs.message}} --channel {{ inputs.channel }}",
    resolved.definitions,
    (environmentName) => `$ENV:${environmentName}`
  );

  assert.deepEqual(resolved.values, {
    message: "release candidate",
    channel: "stable"
  });
  assert.deepEqual(resolved.environment, {
    REPO_CONTROL_INPUT_MESSAGE: "release candidate",
    REPO_CONTROL_INPUT_CHANNEL: "stable"
  });
  assert.equal(
    command,
    "publish --message $ENV:REPO_CONTROL_INPUT_MESSAGE --channel $ENV:REPO_CONTROL_INPUT_CHANNEL"
  );
  assert.equal(command.includes("release candidate"), false);
});

test("rejects missing, duplicate, unknown and undeclared workflow inputs", () => {
  const requiredInput = createInputNode("message", "Release message", true, "");

  assert.throws(
    () => resolveWorkflowInputs([requiredInput], {}),
    (error: unknown) => error instanceof WorkflowInputValidationError
      && error.message === 'Input "Release message" is required'
  );
  assert.throws(
    () => resolveWorkflowInputs([requiredInput, createInputNode("message", "Duplicate", false, "")], {
      message: "value"
    }),
    /defined more than once/
  );
  assert.throws(
    () => resolveWorkflowInputs([requiredInput], { message: "value", other: "unexpected" }),
    /is not declared/
  );

  const definitions = getWorkflowTextInputDefinitions([requiredInput]);
  assert.throws(
    () => interpolateWorkflowInputReferences(
      "echo {{inputs.other}}",
      definitions,
      (environmentName) => environmentName
    ),
    /references undeclared input/
  );
  assert.throws(
    () => interpolateWorkflowInputReferences(
      "echo {{inputs.message",
      definitions,
      (environmentName) => environmentName
    ),
    /malformed workflow input reference/
  );
});

test("requires portable lowercase workflow input keys", () => {
  assert.throws(
    () => resolveWorkflowInputs([createInputNode("Release-Name", "Release", false, "")], {}),
    /must start with a lowercase letter/
  );
});

function createInputNode(
  key: string,
  label: string,
  required: boolean,
  defaultValue: string
): WorkflowNode {
  return {
    id: `input-${key}-${label}`,
    type: "input.text",
    name: label,
    position: { x: 0, y: 0 },
    config: {
      key,
      label,
      required,
      defaultValue
    }
  };
}
