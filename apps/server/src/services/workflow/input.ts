import type { WorkflowNode, WorkflowRunInputs } from "./types.js";
import { getBoolean, getString } from "./value.js";

export const WORKFLOW_INPUT_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const WORKFLOW_INPUT_REFERENCE_PATTERN = /\{\{\s*inputs\.([^{}]+?)\s*\}\}/g;
const MAX_WORKFLOW_INPUTS = 20;
const MAX_WORKFLOW_INPUT_LENGTH = 4000;

export type WorkflowTextInputDefinition = {
  nodeId: string;
  key: string;
  label: string;
  required: boolean;
  defaultValue: string;
  environmentName: string;
};

export type ResolvedWorkflowInputs = {
  definitions: WorkflowTextInputDefinition[];
  values: WorkflowRunInputs;
  environment: NodeJS.ProcessEnv;
};

export class WorkflowInputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowInputValidationError";
  }
}

export function getWorkflowTextInputDefinitions(nodes: WorkflowNode[]): WorkflowTextInputDefinition[] {
  return nodes
    .filter((node) => node.type === "input.text")
    .map((node) => {
      const key = getString(node.config.key, "");

      return {
        nodeId: node.id,
        key,
        label: getString(node.config.label, node.name).slice(0, 120),
        required: getBoolean(node.config.required, true),
        defaultValue: getConfigText(node, "defaultValue").slice(0, MAX_WORKFLOW_INPUT_LENGTH),
        environmentName: toWorkflowInputEnvironmentName(key)
      };
    });
}

export function resolveWorkflowInputs(
  nodes: WorkflowNode[],
  providedInputs: WorkflowRunInputs
): ResolvedWorkflowInputs {
  const definitions = getWorkflowTextInputDefinitions(nodes);

  if (definitions.length > MAX_WORKFLOW_INPUTS) {
    throw new WorkflowInputValidationError(`A workflow can define at most ${MAX_WORKFLOW_INPUTS} text inputs`);
  }

  const definitionsByKey = new Map<string, WorkflowTextInputDefinition>();

  for (const definition of definitions) {
    if (!WORKFLOW_INPUT_KEY_PATTERN.test(definition.key)) {
      throw new WorkflowInputValidationError(
        `Input key "${definition.key || "(empty)"}" must start with a lowercase letter and contain only lowercase letters, numbers or underscores`
      );
    }

    if (definitionsByKey.has(definition.key)) {
      throw new WorkflowInputValidationError(`Input key "${definition.key}" is defined more than once`);
    }

    definitionsByKey.set(definition.key, definition);
  }

  for (const key of Object.keys(providedInputs)) {
    if (!definitionsByKey.has(key)) {
      throw new WorkflowInputValidationError(`Input "${key}" is not declared by this workflow`);
    }
  }

  const values: WorkflowRunInputs = {};
  const environment: NodeJS.ProcessEnv = {};

  for (const definition of definitions) {
    const value = providedInputs[definition.key] ?? definition.defaultValue;

    if (value.length > MAX_WORKFLOW_INPUT_LENGTH) {
      throw new WorkflowInputValidationError(
        `Input "${definition.label}" cannot exceed ${MAX_WORKFLOW_INPUT_LENGTH} characters`
      );
    }

    if (definition.required && !value.trim()) {
      throw new WorkflowInputValidationError(`Input "${definition.label}" is required`);
    }

    values[definition.key] = value;
    environment[definition.environmentName] = value;
  }

  return {
    definitions,
    values,
    environment
  };
}

export function interpolateWorkflowInputReferences(
  command: string,
  definitions: WorkflowTextInputDefinition[],
  getEnvironmentReference: (environmentName: string) => string
): string {
  const definitionsByKey = new Map(definitions.map((definition) => [definition.key, definition]));

  const interpolatedCommand = command.replace(WORKFLOW_INPUT_REFERENCE_PATTERN, (_match, rawKey: string) => {
    const key = rawKey.trim();

    if (!WORKFLOW_INPUT_KEY_PATTERN.test(key)) {
      throw new WorkflowInputValidationError(`Invalid workflow input reference "{{inputs.${key}}}"`);
    }

    const definition = definitionsByKey.get(key);

    if (!definition) {
      throw new WorkflowInputValidationError(`Terminal command references undeclared input "${key}"`);
    }

    return getEnvironmentReference(definition.environmentName);
  });

  if (/\{\{\s*inputs\./.test(interpolatedCommand)) {
    throw new WorkflowInputValidationError("Terminal command contains a malformed workflow input reference");
  }

  return interpolatedCommand;
}

function toWorkflowInputEnvironmentName(key: string): string {
  return `REPO_CONTROL_INPUT_${key.toUpperCase()}`;
}

function getConfigText(node: WorkflowNode, key: string): string {
  const value = node.config[key];
  return typeof value === "string" ? value : "";
}
