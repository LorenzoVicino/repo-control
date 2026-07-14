import { randomUUID } from "node:crypto";
import type { CommandResult } from "../lib/commandRunner.js";
import {
  BrainValidationError,
  appendBrainTaskRun,
  assembleBrainContext,
  getBrainTaskSpecHash,
  readBrainTask
} from "./brainService.js";
import type { BrainRunCheck, BrainTaskRun } from "./brain/types.js";
import { runClaudeMessage } from "./claudeService.js";

const CHECK_TIMEOUT_MS = 1000 * 60 * 10;

export type EngineeringRunInput = {
  prompt: string;
  checks: string[];
};

export type EngineeringRunContext = {
  runShellCommand: (cwd: string, commandLine: string, timeoutMs: number) => Promise<CommandResult>;
};

export async function executeEngineeringRun(
  projectPath: string,
  taskId: string,
  input: EngineeringRunInput,
  context: EngineeringRunContext
): Promise<BrainTaskRun | null> {
  const task = await readBrainTask(projectPath, taskId);

  if (!task) {
    return null;
  }

  if (task.status !== "implementation") {
    throw new BrainValidationError("Approve the task breakdown before starting an engineering run.");
  }

  const startedAt = new Date().toISOString();
  const specHash = getBrainTaskSpecHash(task);
  const brainContext = await assembleBrainContext(projectPath, task);
  const runPrompt = buildRunPrompt(brainContext, input);
  const claudeResult = await runClaudeMessage(
    projectPath,
    runPrompt,
    task.claudeSessionId,
    "acceptEdits",
    task.contextRepositoryPaths
  );
  const checks: BrainRunCheck[] = [];

  if (claudeResult.ok) {
    for (const command of input.checks) {
      const result = await context.runShellCommand(projectPath, command, CHECK_TIMEOUT_MS);
      checks.push({
        id: randomUUID(),
        command,
        ok: result.ok,
        exitCode: result.exitCode,
        output: result.output,
        durationMs: result.durationMs
      });
    }
  }

  const failedCheck = checks.find((check) => !check.ok);
  const succeeded = claudeResult.ok && !failedCheck && checks.length === input.checks.length;
  const run: BrainTaskRun = {
    id: randomUUID(),
    status: succeeded ? "succeeded" : "failed",
    prompt: input.prompt,
    response: claudeResult.response,
    error: claudeResult.error ?? (failedCheck ? `Check failed: ${failedCheck.command}` : null),
    claudeSessionId: claudeResult.sessionId,
    specHash,
    checks,
    startedAt,
    completedAt: new Date().toISOString()
  };

  await appendBrainTaskRun(projectPath, taskId, run);
  return run;
}

function buildRunPrompt(brainContext: string, input: EngineeringRunInput): string {
  const checkList = input.checks.map((command) => `- ${command}`).join("\n");

  return [
    "Implement the approved task in the primary repository.",
    "Use the additional repositories to understand cross-repository dependencies. Treat them as read-only context and do not modify them.",
    "Treat the specification below as authoritative. Keep changes scoped to it and do not edit the specification itself.",
    "The listed verification commands will run after your response, so leave the working tree in a verifiable state.",
    input.prompt ? `Additional operator instruction:\n${input.prompt}` : null,
    `Verification commands:\n${checkList}`,
    brainContext
  ]
    .filter((section): section is string => Boolean(section))
    .join("\n\n");
}
