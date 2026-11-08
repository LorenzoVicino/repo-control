import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { KnowledgeIndex } from "../services/knowledge/index.js";

type KnowledgeRoutesContext = { knowledge: () => KnowledgeIndex };

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(300),
  limit: z.coerce.number().int().min(1).max(20).default(8)
});

export async function registerKnowledgeRoutes(app: FastifyInstance, context: KnowledgeRoutesContext): Promise<void> {
  app.get("/api/knowledge", async () => context.knowledge().status());

  // Indexing runs in the background; the client follows it through GET /api/knowledge.
  app.post("/api/knowledge/reindex", async (_request, reply) => {
    const knowledge = context.knowledge();
    void knowledge.reindex().catch((error: unknown) => app.log.error({ err: error }, "Knowledge indexing failed"));
    return reply.code(202).send(knowledge.status());
  });

  app.get("/api/knowledge/repositories", async () => ({
    repositories: context.knowledge().repositories().map(({ id, name, relativePath, labels, summary, indexedAt }) => ({ id, name, relativePath, labels, summary, indexedAt }))
  }));

  app.get("/api/knowledge/search", async (request, reply) => {
    const parsed = searchQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ ok: false, code: "INVALID_INPUT", message: "Search for at least two characters." });
    const hits = await context.knowledge().search(parsed.data.q, parsed.data.limit);
    return {
      query: parsed.data.q,
      hits: hits.map((hit) => ({
        id: hit.repository.id,
        name: hit.repository.name,
        relativePath: hit.repository.relativePath,
        labels: hit.repository.labels,
        score: Math.round(hit.score * 10_000) / 10_000,
        via: hit.via,
        matches: hit.matches
      }))
    };
  });
}
