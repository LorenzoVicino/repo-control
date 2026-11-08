import type { TFunction } from "i18next";
import type { ProjectSummary } from "../../types/projects";

export type Suggestion = { id: string; title: string; reason: string; prompt: string; tone: "info" | "warning" | "primary" | "success" };

/**
 * Suggestions come from the workspace scan the dashboard already has: a fast-forward that
 * is safe, commits waiting to be pushed, changes waiting for review. The triage prompt is
 * always offered first because it works for any workspace.
 */
export function buildSuggestions(projects: readonly ProjectSummary[], t: TFunction, limit = 4): Suggestion[] {
  const suggestions: Suggestion[] = [
    { id: "triage", tone: "primary", ...copy(t, "triage", "") }
  ];
  const behind = projects.filter((project) => project.behind > 0 && project.isClean).sort((a, b) => b.behind - a.behind);
  const ahead = projects.filter((project) => project.ahead > 0).sort((a, b) => b.ahead - a.ahead);
  const dirty = projects
    .filter((project) => !project.isClean)
    .sort((a, b) => b.staged + b.modified + b.untracked - (a.staged + a.modified + a.untracked));

  if (behind[0]) suggestions.push({ id: `pull-${behind[0].id}`, tone: "info", ...copy(t, "pull", behind[0].name) });
  if (dirty[0]) suggestions.push({ id: `review-${dirty[0].id}`, tone: "warning", ...copy(t, "review", dirty[0].name) });
  if (ahead[0]) suggestions.push({ id: `push-${ahead[0].id}`, tone: "success", ...copy(t, "push", ahead[0].name) });

  return suggestions.slice(0, limit);
}

function copy(t: TFunction, kind: "triage" | "pull" | "push" | "review", name: string) {
  return {
    title: t(`assistant.suggestions.${kind}.title`, { name }),
    reason: t(`assistant.suggestions.${kind}.reason`, { name }),
    prompt: t(`assistant.suggestions.${kind}.prompt`, { name })
  };
}
