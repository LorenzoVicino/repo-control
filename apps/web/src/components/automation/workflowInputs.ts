import type { WorkflowNode, WorkflowRunInputs } from "../../types/workflows";
import type { WorkflowIssue } from "./workflowIssues";

export const WORKFLOW_INPUT_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
export const WORKFLOW_MAX_TEXT_INPUTS = 20;

export type WorkflowTextInputDefinition = {
  nodeId: string;
  key: string;
  label: string;
  description: string;
  placeholder: string;
  defaultValue: string;
  required: boolean;
  multiline: boolean;
};

export function getWorkflowTextInputDefinitions(nodes: WorkflowNode[]): WorkflowTextInputDefinition[] {
  return nodes
    .filter((node) => node.type === "input.text")
    .map((node) => ({
      nodeId: node.id,
      key: getConfigText(node, "key").trim(),
      label: getConfigText(node, "label").trim() || node.name.trim(),
      description: getConfigText(node, "description").trim(),
      placeholder: getConfigText(node, "placeholder"),
      defaultValue: getConfigText(node, "defaultValue"),
      required: getConfigBoolean(node, "required", true),
      multiline: getConfigBoolean(node, "multiline", false)
    }));
}

export function getWorkflowInputConfigurationIssue(nodes: WorkflowNode[]): WorkflowIssue | null {
  const definitions = getWorkflowTextInputDefinitions(nodes);

  if (definitions.length > WORKFLOW_MAX_TEXT_INPUTS) {
    return { code: "tooManyInputs", values: { max: WORKFLOW_MAX_TEXT_INPUTS } };
  }

  const seenKeys = new Set<string>();

  for (const definition of definitions) {
    if (!WORKFLOW_INPUT_KEY_PATTERN.test(definition.key)) {
      return { code: "invalidInputKey", values: { key: definition.key }, nodeId: definition.nodeId };
    }

    if (seenKeys.has(definition.key)) {
      return { code: "duplicateInputKey", values: { key: definition.key }, nodeId: definition.nodeId };
    }

    seenKeys.add(definition.key);
  }

  for (const node of nodes) {
    if (node.type !== "terminal.command") {
      continue;
    }

    const command = getConfigText(node, "command");
    const referencePattern = /\{\{\s*inputs\.([^{}]+?)\s*\}\}/g;

    for (const match of command.matchAll(referencePattern)) {
      const key = match[1]?.trim() ?? "";

      if (!WORKFLOW_INPUT_KEY_PATTERN.test(key)) {
        return { code: "invalidInputReference", values: { name: node.name }, nodeId: node.id };
      }

      if (!seenKeys.has(key)) {
        return { code: "undefinedInputReference", values: { name: node.name, key }, nodeId: node.id };
      }
    }

    if (/\{\{\s*inputs\./.test(command.replace(referencePattern, ""))) {
      return { code: "incompleteInputReference", values: { name: node.name }, nodeId: node.id };
    }
  }

  return null;
}

export function createInitialWorkflowRunInputs(
  definitions: WorkflowTextInputDefinition[]
): WorkflowRunInputs {
  return Object.fromEntries(
    definitions.map((definition) => [definition.key, definition.defaultValue])
  );
}

// Reports which required inputs are still empty. The wording of the field error is a
// presentation concern and belongs to the component that renders it.
export function getMissingRequiredWorkflowInputKeys(
  definitions: WorkflowTextInputDefinition[],
  inputs: WorkflowRunInputs
): string[] {
  return definitions
    .filter((definition) => definition.required && !(inputs[definition.key] ?? "").trim())
    .map((definition) => definition.key);
}

export function getUniqueWorkflowInputKey(nodes: WorkflowNode[], baseKey = "text"): string {
  const keys = new Set(getWorkflowTextInputDefinitions(nodes).map((definition) => definition.key));

  if (!keys.has(baseKey)) {
    return baseKey;
  }

  let suffix = 2;

  while (keys.has(`${baseKey}_${suffix}`)) {
    suffix += 1;
  }

  return `${baseKey}_${suffix}`;
}

function getConfigText(node: WorkflowNode, key: string): string {
  const value = node.config[key];
  return typeof value === "string" ? value : "";
}

function getConfigBoolean(node: WorkflowNode, key: string, fallback: boolean): boolean {
  const value = node.config[key];
  return typeof value === "boolean" ? value : fallback;
}
