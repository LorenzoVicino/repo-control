import type {
  AgentSessionProvider,
  AgentSessionResumeResponse,
  AgentSessionsResponse
} from "../types/agentSessions";
import { jsonRequest, requestJson } from "./http";

export function fetchAgentSessions(search = "", fallbackMessage: string): Promise<AgentSessionsResponse> {
  const normalizedSearch = search.trim();
  const query = normalizedSearch
    ? `?${new URLSearchParams({ search: normalizedSearch }).toString()}`
    : "";

  return requestJson(`/api/agent-sessions${query}`, fallbackMessage);
}

export function resumeAgentSession(
  provider: AgentSessionProvider,
  sessionId: string,
  projectId: string,
  fallbackMessage: string
): Promise<AgentSessionResumeResponse> {
  return requestJson(
    `/api/agent-sessions/${provider}/${encodeURIComponent(sessionId)}/resume`,
    fallbackMessage,
    jsonRequest("POST", { projectId })
  );
}
