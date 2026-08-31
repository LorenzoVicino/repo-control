import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

// Takes the asset directory as an argument rather than importing it: the packaged build is
// produced after the test suite runs, so the behaviour has to be verifiable against a
// fixture directory instead of apps/web/dist.
export async function registerWebAssets(app: FastifyInstance, rootPath: string): Promise<void> {
  await app.register(fastifyStatic, {
    root: rootPath,
    index: ["index.html"]
  });

  // The dashboard is a single-page app, so a GET that matched neither an API route nor a
  // built asset is a client-side route and has to receive index.html. API misses stay JSON
  // so a mistyped endpoint does not answer with a page, and non-GET misses stay 404.
  app.setNotFoundHandler((request, reply) => {
    if (request.method !== "GET" || request.url.startsWith("/api/")) {
      return reply.code(404).send({
        ok: false,
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} not found.`
      });
    }

    return reply.sendFile("index.html");
  });
}
