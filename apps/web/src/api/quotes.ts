import type { DashboardQuoteResponse } from "../types/quotes";
import { requestJson } from "./http";

export function fetchRandomDashboardQuote(signal?: AbortSignal): Promise<DashboardQuoteResponse> {
  return requestJson(
    "/api/quotes/random",
    "Unable to load a Dashboard quote",
    { signal }
  );
}
