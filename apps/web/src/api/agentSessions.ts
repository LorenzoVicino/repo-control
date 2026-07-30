import type {
  AgentSessionProvider,
  AgentSessionResumeResponse,
  AgentSessionsResponse
} from "../types/agentSessions";
import { jsonRequest, requestJson } from "./http";

export function fetchAgentSessions(search = ""): Promise<AgentSessionsResponse> {
  const normalizedSearch = search.trim();
  const query = normalizedSearch
    ? `?${new URLSearchParams({ search: normalizedSearch }).toString()}`
    : "";

  return requestJson(`/api/agent-sessions${query}`, "Impossibile rilevare le sessioni degli agent");
}

export function resumeAgentSession(
  provider: AgentSessionProvider,
  sessionId: string,
  projectId: string
): Promise<AgentSessionResumeResponse> {
  return requestJson(
    `/api/agent-sessions/${provider}/${encodeURIComponent(sessionId)}/resume`,
    "Impossibile aprire la sessione nel terminale",
    jsonRequest("POST", { projectId })
  );
}
