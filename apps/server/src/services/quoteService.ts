import { z } from "zod";

const API_NINJAS_RANDOM_QUOTES_URL = "https://api.api-ninjas.com/v2/randomquotes?categories=wisdom";
const API_TIMEOUT_MS = 5000;
const MAX_DASHBOARD_QUOTE_LENGTH = 600;

const quoteResponseSchema = z
  .array(
    z.object({
      quote: z.string().trim().min(1).max(2000),
      author: z.string().trim().min(1).max(300),
      work: z.string().max(500).default(""),
      categories: z.array(z.string().trim().min(1).max(80)).max(20).default([])
    })
  )
  .min(1);

export type ApiNinjasQuote = {
  text: string;
  author: string;
  work: string | null;
  categories: string[];
  source: "api-ninjas";
};

export async function fetchApiNinjasRandomQuote(apiKey: string): Promise<ApiNinjasQuote> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(API_NINJAS_RANDOM_QUOTES_URL, {
      headers: {
        Accept: "application/json",
        "X-Api-Key": apiKey
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`API Ninjas returned HTTP ${response.status}`);
    }

    const [quote] = quoteResponseSchema.parse(await response.json());

    if (quote.quote.length > MAX_DASHBOARD_QUOTE_LENGTH) {
      throw new Error("API Ninjas returned a quote that is too long for the dashboard");
    }

    return {
      text: quote.quote,
      author: quote.author,
      work: quote.work.trim() || null,
      categories: quote.categories,
      source: "api-ninjas"
    };
  } finally {
    clearTimeout(timeout);
  }
}
