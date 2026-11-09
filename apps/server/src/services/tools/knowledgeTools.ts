import { z } from "zod";
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

export const knowledgeTools = [searchWorkspace];
