import type { WorkflowNode, WorkflowRunInputs } from "../../types/workflows";

export const WORKFLOW_INPUT_KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

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
      label: getConfigText(node, "label").trim() || node.name.trim() || "Input",
      description: getConfigText(node, "description").trim(),
      placeholder: getConfigText(node, "placeholder"),
      defaultValue: getConfigText(node, "defaultValue"),
      required: getConfigBoolean(node, "required", true),
      multiline: getConfigBoolean(node, "multiline", false)
    }));
}

export function getWorkflowInputConfigurationError(nodes: WorkflowNode[]): string | null {
  const definitions = getWorkflowTextInputDefinitions(nodes);

  if (definitions.length > 20) {
    return "Un workflow può contenere al massimo 20 input di testo.";
  }

  const seenKeys = new Set<string>();

  for (const definition of definitions) {
    if (!WORKFLOW_INPUT_KEY_PATTERN.test(definition.key)) {
      return `La chiave “${definition.key || "(vuota)"}” deve iniziare con una lettera minuscola e contenere solo lettere minuscole, numeri o underscore.`;
    }

    if (seenKeys.has(definition.key)) {
      return `La chiave input “${definition.key}” è utilizzata più di una volta.`;
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
        return `Il comando “${node.name}” contiene un riferimento input non valido.`;
      }

      if (!seenKeys.has(key)) {
        return `Il comando “${node.name}” utilizza l'input “${key}”, che non è definito.`;
      }
    }

    if (/\{\{\s*inputs\./.test(command.replace(referencePattern, ""))) {
      return `Il comando “${node.name}” contiene un riferimento input incompleto.`;
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

export function getRequiredWorkflowInputErrors(
  definitions: WorkflowTextInputDefinition[],
  inputs: WorkflowRunInputs
): Record<string, string> {
  return Object.fromEntries(
    definitions
      .filter((definition) => definition.required && !(inputs[definition.key] ?? "").trim())
      .map((definition) => [definition.key, "Questo valore è obbligatorio"])
  );
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
