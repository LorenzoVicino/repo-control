import type { KnowledgeRepository, LabelKind } from "../../types/knowledge";

export const LABEL_KIND_ORDER: LabelKind[] = ["kind", "language", "framework", "topic", "tooling"];

export type LabelCount = { id: string; kind: LabelKind; count: number };

/** Every label in the workspace with how many repositories carry it, grouped by kind. */
export function countLabels(repositories: readonly KnowledgeRepository[]): Map<LabelKind, LabelCount[]> {
  const counts = new Map<string, LabelCount>();
  for (const repository of repositories) {
    for (const label of repository.labels) {
      const key = `${label.kind}:${label.id}`;
      const existing = counts.get(key);
      if (existing) existing.count += 1;
      else counts.set(key, { id: label.id, kind: label.kind, count: 1 });
    }
  }
  const grouped = new Map<LabelKind, LabelCount[]>();
  for (const kind of LABEL_KIND_ORDER) {
    const list = [...counts.values()].filter((label) => label.kind === kind).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
    if (list.length) grouped.set(kind, list);
  }
  return grouped;
}

/** Splits a server snippet on its «match» markers into plain and highlighted parts. */
export function splitHighlights(snippet: string): Array<{ text: string; match: boolean }> {
  const parts: Array<{ text: string; match: boolean }> = [];
  const pattern = /«([^»]*)»/g;
  let last = 0;
  let found: RegExpExecArray | null;
  while ((found = pattern.exec(snippet))) {
    if (found.index > last) parts.push({ text: snippet.slice(last, found.index), match: false });
    parts.push({ text: found[1], match: true });
    last = found.index + found[0].length;
  }
  if (last < snippet.length) parts.push({ text: snippet.slice(last), match: false });
  return parts;
}
