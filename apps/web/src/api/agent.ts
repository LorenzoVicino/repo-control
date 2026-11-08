import type { AgentApprovalDecision, AgentEvent, AgentRunSnapshot, AgentStatus } from "../types/agent";
import { jsonRequest, requestJson } from "./http";

export function fetchAgentStatus(fallbackMessage: string): Promise<AgentStatus> {
  return requestJson("/api/agent", fallbackMessage);
}

/** Starts a run. Pass the session ID of an earlier run to continue that conversation. */
export function startAgentRun(prompt: string, sessionId: string | null, fallbackMessage: string): Promise<AgentRunSnapshot> {
  return requestJson("/api/agent/runs", fallbackMessage, jsonRequest("POST", sessionId ? { prompt, sessionId } : { prompt }));
}

export function decideAgentApproval(
  runId: string,
  approvalId: string,
  decision: AgentApprovalDecision,
  fallbackMessage: string
): Promise<{ ok: true }> {
  return requestJson(
    `/api/agent/runs/${encodeURIComponent(runId)}/approvals/${encodeURIComponent(approvalId)}`,
    fallbackMessage,
    jsonRequest("POST", decision)
  );
}

export function cancelAgentRun(runId: string, fallbackMessage: string): Promise<{ ok: true }> {
  return requestJson(`/api/agent/runs/${encodeURIComponent(runId)}/cancel`, fallbackMessage, jsonRequest("POST", {}));
}

type RunStreamHandlers = {
  onEvent: (event: AgentEvent) => void;
  onEnd: () => void;
  onError: () => void;
};

/**
 * Follows a run over server-sent events. EventSource reconnects on its own and resumes
 * from the last event ID it saw, so a dropped connection loses nothing; the stream is
 * closed once the server signals the end of the run. Returns a function that stops it.
 */
export function subscribeToAgentRun(runId: string, after: number, handlers: RunStreamHandlers): () => void {
  const source = new EventSource(`/api/agent/runs/${encodeURIComponent(runId)}/events?after=${after}`);
  let closed = false;
  const close = () => {
    closed = true;
    source.close();
  };

  source.addEventListener("agent", (message) => {
    try {
      handlers.onEvent(JSON.parse((message as MessageEvent<string>).data) as AgentEvent);
    } catch {
      // A malformed frame is skipped; the next one carries on.
    }
  });
  source.addEventListener("end", () => {
    close();
    handlers.onEnd();
  });
  source.addEventListener("error", () => {
    // CLOSED means the browser gave up reconnecting (for example a 404 for a run the
    // server no longer has); CONNECTING is a retry already under way.
    if (!closed && source.readyState === EventSource.CLOSED) {
      close();
      handlers.onError();
    }
  });

  return close;
}
