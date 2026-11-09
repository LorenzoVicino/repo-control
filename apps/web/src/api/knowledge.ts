import type { KnowledgeHit, KnowledgeRepository, KnowledgeStatus } from "../types/knowledge";
import { jsonRequest, requestJson } from "./http";

export function fetchKnowledgeStatus(fallbackMessage: string): Promise<KnowledgeStatus> {
  return requestJson("/api/knowledge", fallbackMessage);
}

export function reindexKnowledge(fallbackMessage: string): Promise<KnowledgeStatus> {
  return requestJson("/api/knowledge/reindex", fallbackMessage, jsonRequest("POST", {}));
}

export function enableSemanticSearch(fallbackMessage: string): Promise<KnowledgeStatus> {
  return requestJson("/api/knowledge/semantic", fallbackMessage, jsonRequest("POST", {}));
}

export function fetchKnowledgeRepositories(fallbackMessage: string): Promise<{ repositories: KnowledgeRepository[] }> {
  return requestJson("/api/knowledge/repositories", fallbackMessage);
}

export function searchKnowledge(query: string, fallbackMessage: string): Promise<{ query: string; hits: KnowledgeHit[] }> {
  return requestJson(`/api/knowledge/search?${new URLSearchParams({ q: query, limit: "12" }).toString()}`, fallbackMessage);
}
