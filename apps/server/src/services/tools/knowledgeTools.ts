import { z } from "zod";
import { repositoryInput } from "./repositoryTools.js";
import { defineTool, ToolError, type ToolRuntime } from "./types.js";

function requireKnowledge(runtime: ToolRuntime) {
  if (!runtime.knowledge) throw new ToolError("The knowledge index is not available in this context.");
  return runtime.knowledge();
}

export const searchWorkspace = defineTool({
  name: "search_workspace",
  title: "Search the workspace",
  description:
    "Find repositories by what they are about, not just their name: searches READMEs, docs, manifests, dependencies and recent commits " +
    "of every repository, plus their labels (language, framework, kind, tooling, topic). Use it for questions like " +
    '"which repositories use Fastify?", "where is the billing logic?" or "what deploys with Docker?".',
  effect: "read",
  inputShape: {
    query: z.string().trim().min(2).max(300).describe("What to look for, in plain words."),
    limit: z.number().int().min(1).max(10).default(5).describe("How many repositories to return.")
  },
  async run(runtime, input) {
    const knowledge = requireKnowledge(runtime);
    const hits = await knowledge.search(input.query, input.limit);
    const { semantic } = knowledge.status();
    const mode = semantic.enabled ? "full-text and semantic" : "full-text";
    if (!hits.length) return { text: `No repository matches "${input.query}" (${mode} search).`, data: { hits: [] } };

    const lines = hits.map((hit, index) => {
      const labels = hit.repository.labels.slice(0, 6).map((label) => label.id).join(", ");
      const matches = hit.matches.map((match) => `   - ${match.path || match.kind}: ${match.snippet}`).join("\n");
      return `${index + 1}. ${hit.repository.name} (${hit.repository.relativePath})${labels ? ` [${labels}]` : ""}\n${matches}`;
    });
    return {
      text: `${hits.length} repositories match "${input.query}" (${mode} search):\n${lines.join("\n")}`,
      data: {
        hits: hits.map((hit) => ({
          id: hit.repository.id,
          name: hit.repository.name,
          relativePath: hit.repository.relativePath,
          labels: hit.repository.labels.map((label) => label.id),
          via: hit.via,
          matches: hit.matches
        }))
      }
    };
  }
});

export const repositoryRelations = defineTool({
  name: "repository_relations",
  title: "Repository relations",
  description:
    "Show how one repository relates to the others in the workspace: which repositories it depends on and which depend on it " +
    "(through published packages), which it mentions and which mention it (in READMEs, docs, manifests or commits), which mean " +
    'something similar, and which share its frameworks and topics. Use it for "who depends on X?" or "what would a change to X touch?".',
  effect: "read",
  inputShape: { repository: repositoryInput },
  async run(runtime, input) {
    const knowledge = requireKnowledge(runtime);
    const { project } = await runtime.resolveRepository(input.repository);
    const relations = await knowledge.relations(project.id);
    if (!relations) throw new ToolError(`${project.name} is not in the knowledge index yet. Try again after indexing finishes.`);

    const section = (title: string, entries: Array<{ repository: { name: string }; evidence: string[] }>) =>
      entries.length ? `${title} (${entries.length}):\n${entries.map((entry) => `  - ${entry.repository.name}: ${entry.evidence.join("; ")}`).join("\n")}` : `${title}: none.`;
    const text = [
      `${project.name} [${relations.repository.labels.slice(0, 6).map((label) => label.id).join(", ")}]`,
      section("Depends on", relations.dependsOn),
      section("Used by", relations.usedBy),
      section("Mentions", relations.mentions),
      section("Mentioned by", relations.mentionedBy),
      relations.similar.length ? section("Similar in meaning", relations.similar) : "",
      relations.sharesLabels.length
        ? `Shares frameworks or topics with: ${relations.sharesLabels.map((entry) => `${entry.repository.name} (${entry.labels.join(", ")})`).join("; ")}.`
        : "Shares no frameworks or topics with other repositories."
    ]
      .filter(Boolean)
      .join("\n");

    const brief = (entries: Array<{ repository: { id: string; name: string }; evidence: string[] }>) => entries.map((entry) => ({ id: entry.repository.id, name: entry.repository.name, evidence: entry.evidence }));
    return {
      text,
      data: {
        dependsOn: brief(relations.dependsOn),
        usedBy: brief(relations.usedBy),
        mentions: brief(relations.mentions),
        mentionedBy: brief(relations.mentionedBy),
        similar: brief(relations.similar),
        sharesLabels: relations.sharesLabels.map((entry) => ({ id: entry.repository.id, name: entry.repository.name, labels: entry.labels }))
      }
    };
  }
});

export const knowledgeTools = [searchWorkspace, repositoryRelations];
