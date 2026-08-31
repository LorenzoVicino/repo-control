import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTaskPlanningPrompt,
  createTaskPlanDraft,
  parseTaskPlanningResponse
} from "./taskPlanningService.js";

const validPlan = {
  title: "Make failed runs relaunchable",
  type: "feature",
  profile: "full",
  description: "Allow relaunching while keeping the previous run context.",
  motivation: "Reduce the manual work after a failed verification.",
  requirements: ["The relaunch keeps the context pack"],
  acceptanceCriteria: ["A failed run can be relaunched from its own page"],
  approach: "Extend the run service and add a contextual action in the UI.",
  impactedAreas: ["apps/server/src/services/engineeringRunService.ts"],
  risks: ["The context can go stale; verify the spec hash"],
  steps: ["Add the relaunch contract", "Expose the command in the UI"],
  checks: ["npm run check", "rm -rf dist"],
  assumptions: ["The original run is still persisted"],
  questions: [{
    id: "retry-policy",
    question: "Must the relaunch create a new run?",
    options: ["Yes, a new run", "No, reuse the run"],
    recommendedOption: "Yes, a new run"
  }]
};

const planningInput = {
  brief: "Make failed runs relaunchable",
  profile: "full" as const,
  contextRepositoryPaths: []
};

test("parses a fenced JSON planning response", () => {
  const parsed = parseTaskPlanningResponse(`\n\`\`\`json\n${JSON.stringify(validPlan)}\n\`\`\`\n`);

  assert.equal(parsed.title, validPlan.title);
  assert.equal(parsed.questions[0]?.id, "retry-policy");
});

test("creates review Markdown and removes unsafe verification commands", () => {
  const draft = createTaskPlanDraft(JSON.stringify(validPlan), "Claude Code", "session-1");

  assert.equal(draft.sessionId, "session-1");
  assert.deepEqual(draft.checks, ["npm run check"]);
  assert.match(draft.requirements, /Acceptance criteria/);
  assert.match(draft.design, /engineeringRunService\.ts/);
  assert.match(draft.breakdown, /Implementation steps/);
});

test("writes the review Markdown headings in the requested language", () => {
  const draft = createTaskPlanDraft(JSON.stringify(validPlan), "Claude Code", "session-1", "it");

  assert.match(draft.requirements, /Criteri di accettazione/);
  assert.match(draft.design, /Rischi e mitigazioni/);
  assert.match(draft.breakdown, /Passi di implementazione/);
});

test("asks the agent to write the plan in the requested language", () => {
  assert.match(buildTaskPlanningPrompt(planningInput, ""), /Write the content in English\./);
  assert.match(
    buildTaskPlanningPrompt({ ...planningInput, language: "it" }, ""),
    /Write the content in Italian\./
  );
});

test("rejects a plan without safe verification commands", () => {
  const unsafePlan = { ...validPlan, checks: ["sudo rm -rf /"] };

  assert.throws(
    () => createTaskPlanDraft(JSON.stringify(unsafePlan)),
    /no safe verification command/
  );
});
