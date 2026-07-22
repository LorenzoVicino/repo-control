import assert from "node:assert/strict";
import test from "node:test";
import { createTaskPlanDraft, parseTaskPlanningResponse } from "./taskPlanningService.js";

const validPlan = {
  title: "Rendi rilanciabili i run falliti",
  type: "feature",
  profile: "full",
  description: "Consentire il rilancio mantenendo il contesto del run precedente.",
  motivation: "Ridurre il lavoro manuale dopo una verifica fallita.",
  requirements: ["Il rilancio conserva il context pack"],
  acceptanceCriteria: ["Un run fallito può essere rilanciato dalla sua pagina"],
  approach: "Estendere il servizio dei run e aggiungere un'azione contestuale nella UI.",
  impactedAreas: ["apps/server/src/services/engineeringRunService.ts"],
  risks: ["Il contesto può diventare obsoleto; verificare lo spec hash"],
  steps: ["Aggiungere il contratto di rilancio", "Esporre il comando nella UI"],
  checks: ["npm run check", "rm -rf dist"],
  assumptions: ["Il run originale è ancora persistito"],
  questions: [{
    id: "retry-policy",
    question: "Il rilancio deve creare un nuovo run?",
    options: ["Sì, nuovo run", "No, riusa il run"],
    recommendedOption: "Sì, nuovo run"
  }]
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
  assert.match(draft.requirements, /Criteri di accettazione/);
  assert.match(draft.design, /engineeringRunService\.ts/);
  assert.match(draft.breakdown, /Passi di implementazione/);
});

test("rejects a plan without safe verification commands", () => {
  const unsafePlan = { ...validPlan, checks: ["sudo rm -rf /"] };

  assert.throws(
    () => createTaskPlanDraft(JSON.stringify(unsafePlan)),
    /nessun comando di verifica sicuro/
  );
});
