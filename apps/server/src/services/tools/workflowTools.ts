import { z } from "zod";
import { getWorkflowTextInputDefinitions, WorkflowInputValidationError } from "../workflow/input.js";
import type { WorkflowDefinition, WorkflowRun } from "../workflow/types.js";
import { WorkflowDefinitionValidationError } from "../workflow/validation.js";
import {
  cancelWorkflowRun,
  executeDryRun,
  getWorkflowRun,
  readWorkflowRuns,
  readWorkflows,
  startWorkflowRun,
  WorkflowRunConflictError
} from "../workflowService.js";
import { count, tail } from "./format.js";
import { defineTool, ToolError } from "./types.js";

// Workflows are pipelines the user built and saved in the dashboard. The agent may find,
// preview and run them, but there is deliberately no tool to create or edit one: a
// workflow can hold arbitrary shell commands, so authoring stays with the user.

const workflowInput = z.string().trim().min(1).max(160).describe("Workflow id or name, as listed by list_workflows.");
const runInput = z.string().trim().min(1).max(160).describe("Run id returned by run_workflow or preview_workflow.");
const inputsInput = z
  .record(z.string().regex(/^[a-z][a-z0-9_]{0,39}$/), z.string().max(4000))
  .default({})
  .describe("Values for the workflow's text inputs, keyed by input key (see list_workflows).");

async function findWorkflow(reference: string): Promise<WorkflowDefinition> {
  const { workflows } = await readWorkflows();
  const byId = workflows.find((workflow) => workflow.id === reference);
  if (byId) return byId;
  const byName = workflows.filter((workflow) => workflow.name.toLowerCase() === reference.toLowerCase());
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) throw new ToolError(`"${reference}" matches ${byName.length} workflows. Use the id instead: ${byName.map((workflow) => workflow.id).join(", ")}.`);
  throw new ToolError(
    workflows.length
      ? `No workflow called "${reference}". Saved workflows: ${workflows.map((workflow) => workflow.name).join(", ")}.`
      : `No workflow called "${reference}": none have been saved yet.`
  );
}

function asToolError(error: unknown): never {
  if (error instanceof WorkflowInputValidationError || error instanceof WorkflowDefinitionValidationError || error instanceof WorkflowRunConflictError) {
    throw new ToolError(error.message);
  }
  throw error;
}

function describeRun(run: WorkflowRun): string {
  const { summary } = run;
  const header =
    `${run.mode === "dry-run" ? "Preview" : "Run"} ${run.id} of "${run.workflowName}": ${run.status}` +
    `${run.statusMessage ? ` (${run.statusMessage})` : ""}. ` +
    `${count(summary.selectedProjects, "repository", "repositories")}, ${count(summary.commands, "command")}. ` +
    `Steps: ${summary.succeeded} succeeded, ${summary.failed} failed, ${summary.skipped} skipped.`;
  const steps = run.steps.map((step) => {
    const target = step.projectName ? ` [${step.projectName}]` : "";
    const command = step.command ? ` \`${step.command}\`` : "";
    const failure = step.status === "failed" ? `\n    ${tail((step.stderr || step.stdout).trim(), 600).replace(/\n/g, "\n    ")}` : "";
    return `- ${step.status} ${step.nodeName}${target}${command}${step.message ? `: ${step.message}` : ""}${failure}`;
  });
  return [header, ...steps.slice(0, 60), steps.length > 60 ? `… ${steps.length - 60} more steps` : ""].filter(Boolean).join("\n");
}

function compactRun(run: WorkflowRun) {
  return {
    ...run,
    steps: run.steps.map((step) => ({ ...step, stdout: tail(step.stdout, 1_000), stderr: tail(step.stderr, 1_000) }))
  };
}

export const listWorkflows = defineTool({
  name: "list_workflows",
  title: "List workflows",
  description:
    "List the workflows saved in the dashboard: multi-repository pipelines such as fetch, pull, Docker and shell steps. " +
    "Shows each workflow's steps, the text inputs it expects and its latest run.",
  effect: "read",
  inputShape: {},
  async run() {
    const [{ workflows }, { runs }] = await Promise.all([readWorkflows(), readWorkflowRuns()]);
    const entries = workflows.map((workflow) => {
      const inputs = getWorkflowTextInputDefinitions(workflow.nodes).map((input) => ({
        key: input.key,
        label: input.label,
        required: input.required,
        defaultValue: input.defaultValue
      }));
      const latest = runs.find((run) => run.workflowId === workflow.id && run.mode === "run");
      return { workflow, inputs, latest };
    });
    const lines = entries.map(({ workflow, inputs, latest }) => {
      const steps = workflow.nodes.filter((node) => !node.type.startsWith("trigger.") && !node.type.startsWith("input.")).map((node) => node.name);
      return (
        `- ${workflow.name} (id ${workflow.id})${workflow.description ? `: ${workflow.description}` : ""}\n` +
        `  steps: ${steps.join(" → ") || "none"}` +
        `${inputs.length ? `\n  inputs: ${inputs.map((input) => `${input.key}${input.required && !input.defaultValue ? " (required)" : ""}`).join(", ")}` : ""}` +
        `${latest ? `\n  last run: ${latest.status} at ${latest.startedAt}` : ""}`
      );
    });
    return {
      text: lines.length ? `${count(lines.length, "workflow")}.\n${lines.join("\n")}` : "No workflows have been saved yet.",
      data: {
        workflows: entries.map(({ workflow, inputs, latest }) => ({
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          steps: workflow.nodes.map((node) => ({ name: node.name, type: node.type })),
          inputs,
          lastRun: latest ? { id: latest.id, status: latest.status, startedAt: latest.startedAt } : null
        }))
      }
    };
  }
});

export const previewWorkflow = defineTool({
  name: "preview_workflow",
  title: "Preview a workflow",
  description:
    "Dry-run a workflow: resolve which repositories it would touch and the exact command for each step, without running any of them. " +
    "Use it before run_workflow so the user can see what will happen.",
  effect: "read",
  inputShape: { workflow: workflowInput, inputs: inputsInput },
  async run(runtime, input) {
    const workflow = await findWorkflow(input.workflow);
    const run = await executeDryRun(workflow.id, runtime.workflows, input.inputs).catch(asToolError);
    if (!run) throw new ToolError(`Workflow "${input.workflow}" no longer exists.`);
    return { text: describeRun(run), data: compactRun(run) };
  }
});

export const runWorkflow = defineTool({
  name: "run_workflow",
  title: "Run a workflow",
  description:
    "Start a saved workflow. It runs in the background and this returns at once with a run id; follow it with get_workflow_run. " +
    "A workflow can run shell commands across many repositories, so preview it first.",
  effect: "write",
  hints: { destructive: true, openWorld: true },
  inputShape: { workflow: workflowInput, inputs: inputsInput },
  async run(runtime, input) {
    const workflow = await findWorkflow(input.workflow);
    const run = await startWorkflowRun(workflow.id, runtime.workflows, input.inputs).catch(asToolError);
    if (!run) throw new ToolError(`Workflow "${input.workflow}" no longer exists.`);
    return {
      text: `Started "${workflow.name}" as run ${run.id}. Check progress with get_workflow_run.`,
      data: { runId: run.id, workflowId: workflow.id, status: run.status }
    };
  }
});

export const getWorkflowRunTool = defineTool({
  name: "get_workflow_run",
  title: "Read a workflow run",
  description: "Show the status and steps of one workflow run, with the error output of failed steps. Omit runId for the most recent run.",
  effect: "read",
  inputShape: { runId: runInput.optional() },
  async run(_runtime, input) {
    const run = input.runId ? await getWorkflowRun(input.runId) : (await readWorkflowRuns()).runs[0];
    if (!run) throw new ToolError(input.runId ? `No workflow run with id "${input.runId}".` : "No workflow has run yet.");
    return { text: describeRun(run), data: compactRun(run) };
  }
});

export const cancelWorkflowRunTool = defineTool({
  name: "cancel_workflow_run",
  title: "Cancel a workflow run",
  description: "Cancel a workflow run that is still in progress. Steps already finished are not undone.",
  effect: "write",
  hints: { idempotent: true },
  inputShape: { runId: runInput },
  async run(_runtime, input) {
    const run = await getWorkflowRun(input.runId);
    if (!run) throw new ToolError(`No workflow run with id "${input.runId}".`);
    if (cancelWorkflowRun(input.runId) !== "cancelled") throw new ToolError(`Run ${input.runId} is not in progress (status ${run.status}).`);
    return { text: `Cancelling run ${input.runId} of "${run.workflowName}".`, data: { runId: input.runId, cancelled: true } };
  }
});

export const workflowTools = [listWorkflows, previewWorkflow, runWorkflow, getWorkflowRunTool, cancelWorkflowRunTool];
