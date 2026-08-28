import type { TFunction } from "i18next";

// Pure workflow logic reports issues as stable codes plus interpolation values, so
// validation stays language-independent and the active locale is applied at render.
export type WorkflowIssueCode =
  | "duplicateNodeId"
  | "singleTrigger"
  | "needsAction"
  | "commandRequired"
  | "repositorySelectionRequired"
  | "edgeMissingNode"
  | "selfConnection"
  | "multipleOutputs"
  | "multipleInputs"
  | "triggerMustBeFirst"
  | "summaryMustBeLast"
  | "cycle"
  | "disconnectedNodes"
  | "disconnectedNodesMore"
  | "noRepositorySelectWarning"
  | "noSummaryWarning"
  | "tooManyInputs"
  | "invalidInputKey"
  | "duplicateInputKey"
  | "invalidInputReference"
  | "undefinedInputReference"
  | "incompleteInputReference";

export type WorkflowIssue = {
  code: WorkflowIssueCode;
  values?: Record<string, string | number>;
  nodeId?: string;
};

type WorkflowIssueKey = `automation.issues.${WorkflowIssueCode}`;

type WorkflowIssueTranslator = (
  key: WorkflowIssueKey,
  values: Record<string, string | number>
) => string;

export function formatWorkflowIssue(t: TFunction, issue: WorkflowIssue): string {
  // i18next derives interpolation types per individual key, so it cannot verify one
  // shared values bag against a union of issue keys. The key stays typed as
  // WorkflowIssueKey; only the values signature is widened here.
  const translateIssue = t as unknown as WorkflowIssueTranslator;

  return translateIssue(`automation.issues.${issue.code}`, issue.values ?? {});
}

// Two issues are the same when they would render the same sentence, which depends on
// the interpolation values and not only on the code.
export function getWorkflowIssueIdentity(issue: WorkflowIssue): string {
  const values = issue.values ?? {};
  const serializedValues = Object.keys(values)
    .sort()
    .map((key) => `${key}=${String(values[key])}`)
    .join("|");

  return `${issue.code}#${serializedValues}`;
}
