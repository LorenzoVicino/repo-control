import { describe, expect, it } from "vitest";
import type { WorkflowNode } from "../../types/workflows";
import {
  createInitialWorkflowRunInputs,
  getRequiredWorkflowInputErrors,
  getUniqueWorkflowInputKey,
  getWorkflowInputConfigurationError,
  getWorkflowTextInputDefinitions
} from "./workflowInputs";

describe("workflow inputs", () => {
  it("reads input definitions and prepares defaults for a run", () => {
    const nodes = [
      createInputNode("message", { label: "Messaggio", defaultValue: "release", required: true }),
      createInputNode("notes", { label: "Note", multiline: true, required: false })
    ];
    const definitions = getWorkflowTextInputDefinitions(nodes);

    expect(definitions).toEqual([
      expect.objectContaining({
        key: "message",
        label: "Messaggio",
        defaultValue: "release",
        required: true,
        multiline: false
      }),
      expect.objectContaining({
        key: "notes",
        label: "Note",
        defaultValue: "",
        required: false,
        multiline: true
      })
    ]);
    expect(createInitialWorkflowRunInputs(definitions)).toEqual({
      message: "release",
      notes: ""
    });
  });

  it("reports invalid configuration and missing required values", () => {
    const duplicateNodes = [
      createInputNode("message", { required: true }),
      createInputNode("message", { required: false })
    ];
    const definitions = getWorkflowTextInputDefinitions([createInputNode("message", { required: true })]);

    expect(getWorkflowInputConfigurationError(duplicateNodes)).toContain("più di una volta");
    expect(getWorkflowInputConfigurationError([createInputNode("Release-Name", {})])).toContain("lettera minuscola");
    expect(getWorkflowInputConfigurationError([
      createInputNode("message", {}),
      createTerminalNode("echo {{inputs.other}}")
    ])).toContain("non è definito");
    expect(getRequiredWorkflowInputErrors(definitions, { message: " " })).toEqual({
      message: "Questo valore è obbligatorio"
    });
  });

  it("creates collision-free keys for newly added input nodes", () => {
    const nodes = [
      createInputNode("text", {}),
      createInputNode("text_2", {})
    ];

    expect(getUniqueWorkflowInputKey(nodes)).toBe("text_3");
  });
});

function createInputNode(
  key: string,
  config: Record<string, unknown>
): WorkflowNode {
  return {
    id: `input-${key}-${String(config.label ?? "")}`,
    type: "input.text",
    name: "Input di testo",
    position: { x: 0, y: 0 },
    config: {
      key,
      label: "",
      description: "",
      placeholder: "",
      defaultValue: "",
      required: true,
      multiline: false,
      ...config
    }
  };
}

function createTerminalNode(command: string): WorkflowNode {
  return {
    id: "terminal",
    type: "terminal.command",
    name: "Terminal",
    position: { x: 200, y: 0 },
    config: { command }
  };
}
