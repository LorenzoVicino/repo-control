import type { FastifyInstance } from "fastify";
import { fetchApiNinjasRandomQuote } from "../services/quoteService.js";

type QuoteRoutesContext = {
  apiNinjasApiKey: string | undefined;
};

export async function registerQuoteRoutes(app: FastifyInstance, context: QuoteRoutesContext): Promise<void> {
  app.get("/api/quotes/random", async (request) => {
    if (!context.apiNinjasApiKey) {
      return {
        configured: false,
        quote: null
      };
    }

    try {
      return {
        configured: true,
        quote: await fetchApiNinjasRandomQuote(context.apiNinjasApiKey)
      };
    } catch (error) {
      request.log.warn({ err: error }, "Unable to load a quote from API Ninjas");

      return {
        configured: true,
        quote: null
      };
    }
  });
}
