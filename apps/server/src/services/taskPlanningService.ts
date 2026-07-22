import { z } from "zod";
import { getAgentProvider } from "./agentProvider.js";
import { assembleBrainContext } from "./brainService.js";
import type {
  BrainAgentProvider,
  BrainTask,
  BrainTaskProfile,
  BrainTaskType
} from "./brain/types.js";

export type TaskPlanningProfilePreference = BrainTaskProfile | "auto";

export type TaskPlanningQuestion = {
  id: string;
  question: string;
  options: string[];
  recommendedOption: string | null;
};

export type TaskPlanDraft = {
  provider: Exclude<BrainAgentProvider, "manual">;
  providerLabel: string;
  sessionId: string | null;
  generatedAt: string;
  title: string;
  type: BrainTaskType;
  profile: BrainTaskProfile;
  description: string;
  motivation: string;
  requirements: string;
  design: string;
  breakdown: string;
  checks: string[];
  assumptions: string[];
  questions: TaskPlanningQuestion[];
};

export type TaskPlanningInput = {
  brief: string;
  profile: TaskPlanningProfilePreference;
  contextRepositoryPaths: string[];
  feedback?: string;
  answers?: Record<string, string>;
  currentDraft?: TaskPlanDraft;
};

export class TaskPlanningError extends Error {
  statusCode = 502;
}

const rawQuestionSchema = z.object({
  id: z.string().trim().max(80).optional(),
  question: z.string().trim().min(1).max(600),
  options: z.array(z.string().trim().min(1).max(240)).min(2).max(4),
  recommendedOption: z.string().trim().max(240).nullable().optional()
});

const rawPlanSchema = z.object({
  title: z.string().trim().min(1).max(160),
  type: z.enum(["feature", "fix", "refactor", "chore", "spike"]),
  profile: z.enum(["lean", "full", "research"]),
  description: z.string().trim().min(1).max(20_000),
  motivation: z.string().trim().max(20_000).default(""),
  requirements: z.array(z.string().trim().min(1).max(2000)).min(1).max(16),
  acceptanceCriteria: z.array(z.string().trim().min(1).max(2000)).min(1).max(16),
  approach: z.string().trim().min(1).max(20_000),
  impactedAreas: z.array(z.string().trim().min(1).max(1000)).max(16).default([]),
  risks: z.array(z.string().trim().min(1).max(2000)).max(12).default([]),
  steps: z.array(z.string().trim().min(1).max(3000)).min(1).max(20),
  checks: z.array(z.string().trim().min(1).max(1000)).min(1).max(12),
  assumptions: z.array(z.string().trim().min(1).max(2000)).max(12).default([]),
  questions: z.array(rawQuestionSchema).max(3).default([])
});

export async function planEngineeringTask(
  projectPath: string,
  input: TaskPlanningInput,
  signal?: AbortSignal
): Promise<TaskPlanDraft> {
  const provider = getAgentProvider();
  const brainContext = await assembleBrainContext(
    projectPath,
    createPlanningContextTask(input)
  );
  const prompt = buildTaskPlanningPrompt(input, brainContext);
  const result = await provider.run({
    cwd: projectPath,
    prompt,
    mode: "plan",
    sessionId: input.currentDraft?.sessionId,
    additionalDirectories: input.contextRepositoryPaths,
    signal
  });

  if (!result.ok) {
    throw new TaskPlanningError(result.error || `${provider.label} non è riuscito a preparare il piano.`);
  }

  try {
    return createTaskPlanDraft(result.response, provider.label, result.sessionId);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "risposta non valida";
    throw new TaskPlanningError(`${provider.label} ha restituito un piano non valido: ${detail}`);
  }
}

export function createTaskPlanDraft(
  response: string,
  providerLabel = "Claude Code",
  sessionId: string | null = null
): TaskPlanDraft {
  return toTaskPlanDraft(parseTaskPlanningResponse(response), "claude", providerLabel, sessionId);
}

export function parseTaskPlanningResponse(response: string): z.infer<typeof rawPlanSchema> {
  const candidate = extractJsonObject(response);
  return rawPlanSchema.parse(candidate);
}

export function buildTaskPlanningPrompt(input: TaskPlanningInput, brainContext: string): string {
  const clarificationSection = input.answers && Object.keys(input.answers).length > 0
    ? `Clarifications chosen by the user:\n${JSON.stringify(input.answers, null, 2)}`
    : null;
  const feedbackSection = input.feedback?.trim()
    ? `Requested changes to the draft:\n${input.feedback.trim()}`
    : null;
  const currentDraftSection = input.currentDraft
    ? `Current draft to improve:\n${JSON.stringify(toPromptDraft(input.currentDraft), null, 2)}`
    : null;

  return [
    "You are the planning agent for repo-control. Inspect the repository in read-only mode and turn the user's brief into an implementation-ready engineering plan.",
    "Do not edit, create, delete, stage, or commit files. Use repository evidence instead of inventing paths, scripts, or architecture.",
    "Write the content in Italian. Keep file paths, commands, identifiers, and technical names unchanged.",
    `Requested planning profile: ${input.profile}. Choose lean for small fixes/chores, full for features/refactors, and research for spikes when auto is requested.`,
    "Ask at most three questions, and only for decisions that materially change scope or architecture. Always provide a complete provisional plan even when questions remain.",
    "Verification commands must exist or be strongly supported by repository configuration. Return one safe, non-destructive command per item; never use shell chaining, sudo, rm, git mutation, deployment, or network publication commands.",
    "Return only a JSON object with this exact shape and no Markdown fences:",
    JSON.stringify({
      title: "Titolo breve e specifico",
      type: "feature | fix | refactor | chore | spike",
      profile: "lean | full | research",
      description: "Problema e risultato desiderato",
      motivation: "Perché il cambiamento serve",
      requirements: ["Requisito funzionale o vincolo"],
      acceptanceCriteria: ["Criterio osservabile e verificabile"],
      approach: "Approccio tecnico proposto basato sul repository",
      impactedAreas: ["percorso relativo o area del sistema"],
      risks: ["Rischio e relativa mitigazione"],
      steps: ["Passo di implementazione ordinato"],
      checks: ["comando di verifica"],
      assumptions: ["Assunzione esplicita"],
      questions: [{
        id: "stable-id",
        question: "Decisione richiesta",
        options: ["Opzione A", "Opzione B"],
        recommendedOption: "Opzione A"
      }]
    }, null, 2),
    `User brief:\n${input.brief.trim()}`,
    clarificationSection,
    feedbackSection,
    currentDraftSection,
    brainContext
  ]
    .filter((section): section is string => Boolean(section))
    .join("\n\n");
}

function toTaskPlanDraft(
  rawPlan: z.infer<typeof rawPlanSchema>,
  provider: "claude",
  providerLabel: string,
  sessionId: string | null
): TaskPlanDraft {
  const assumptions = uniqueStrings(rawPlan.assumptions);
  const checks = uniqueStrings(rawPlan.checks).filter(isSafeVerificationCommand);

  if (checks.length === 0) {
    throw new Error("nessun comando di verifica sicuro è stato proposto");
  }

  const questions = rawPlan.questions.map((question, index) => {
    const options = uniqueStrings(question.options);
    const recommendedOption = question.recommendedOption && options.includes(question.recommendedOption)
      ? question.recommendedOption
      : null;

    return {
      id: question.id || `question-${index + 1}`,
      question: question.question,
      options,
      recommendedOption
    };
  });

  return {
    provider,
    providerLabel,
    sessionId,
    generatedAt: new Date().toISOString(),
    title: rawPlan.title,
    type: rawPlan.type,
    profile: rawPlan.profile,
    description: rawPlan.description,
    motivation: rawPlan.motivation,
    requirements: [
      markdownList("Requisiti", rawPlan.requirements),
      markdownChecklist("Criteri di accettazione", rawPlan.acceptanceCriteria)
    ].join("\n\n"),
    design: [
      `## Approccio\n${rawPlan.approach}`,
      markdownList("Aree impattate", rawPlan.impactedAreas),
      markdownList("Rischi e mitigazioni", rawPlan.risks),
      markdownList("Assunzioni", assumptions)
    ].filter(Boolean).join("\n\n"),
    breakdown: [
      markdownNumberedList("Passi di implementazione", rawPlan.steps),
      markdownList("Verifiche", checks)
    ].join("\n\n"),
    checks,
    assumptions,
    questions
  };
}

function createPlanningContextTask(input: TaskPlanningInput): BrainTask {
  const now = new Date().toISOString();
  const profile = input.profile === "auto" ? "full" : input.profile;

  return {
    id: "planning-draft",
    title: input.currentDraft?.title || "Nuovo task da pianificare",
    type: input.currentDraft?.type || "feature",
    status: "definition",
    contextRepositoryPaths: input.contextRepositoryPaths,
    definition: {
      description: input.brief,
      motivation: input.currentDraft?.motivation || ""
    },
    requirements: { content: input.currentDraft?.requirements || "", approvedAt: null },
    design: { content: input.currentDraft?.design || "", approvedAt: null },
    breakdown: { content: input.currentDraft?.breakdown || "", approvedAt: null },
    verificationChecks: input.currentDraft?.checks || [],
    planning: {
      profile,
      provider: "claude",
      brief: input.brief,
      generatedAt: input.currentDraft?.generatedAt || null,
      assumptions: input.currentDraft?.assumptions || []
    },
    implementation: { log: [], runs: [] },
    decisions: [],
    git: { branch: null, prUrl: null },
    claudeSessionId: input.currentDraft?.sessionId || null,
    createdAt: now,
    updatedAt: now
  };
}

function extractJsonObject(response: string): unknown {
  const trimmed = response.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const withoutFence = trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();

    try {
      return JSON.parse(withoutFence);
    } catch {
      const firstBrace = withoutFence.indexOf("{");
      const lastBrace = withoutFence.lastIndexOf("}");

      if (firstBrace >= 0 && lastBrace > firstBrace) {
        return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
      }

      throw new Error("JSON non trovato nella risposta");
    }
  }
}

function toPromptDraft(draft: TaskPlanDraft): Record<string, unknown> {
  return {
    title: draft.title,
    type: draft.type,
    profile: draft.profile,
    description: draft.description,
    motivation: draft.motivation,
    requirements: draft.requirements,
    design: draft.design,
    breakdown: draft.breakdown,
    checks: draft.checks,
    assumptions: draft.assumptions,
    questions: draft.questions
  };
}

function markdownList(title: string, items: string[]): string {
  const values = uniqueStrings(items);
  return values.length > 0 ? `## ${title}\n${values.map((item) => `- ${item}`).join("\n")}` : "";
}

function markdownChecklist(title: string, items: string[]): string {
  return `## ${title}\n${uniqueStrings(items).map((item) => `- [ ] ${item}`).join("\n")}`;
}

function markdownNumberedList(title: string, items: string[]): string {
  return `## ${title}\n${uniqueStrings(items).map((item, index) => `${index + 1}. ${item}`).join("\n")}`;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isSafeVerificationCommand(command: string): boolean {
  if (/[;&|`<>]/.test(command)) return false;

  return !/(^|\s)(sudo|rm|shutdown|reboot)(\s|$)|\bgit\s+(reset|clean|push|commit|checkout|switch)\b|\bdocker\s+(rm|rmi|system\s+prune)\b/i.test(command);
}
