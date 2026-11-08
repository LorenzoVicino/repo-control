import type { AgentEvent, AgentEventBody, AgentRunSnapshot } from "../types/agent";
import type { AgentApi } from "../components/assistant/conversationStore";

// Test double for the agent API: records calls and lets a test push server events into the
// run that is currently being followed.
export function createFakeAgentApi() {
  let handlers: Parameters<AgentApi["subscribeToAgentRun"]>[2] | null = null;
  let seq = 0;
  const calls = {
    start: [] as Array<{ prompt: string; sessionId: string | null }>,
    decisions: [] as Array<{ runId: string; approvalId: string; behavior: string }>,
    cancelled: [] as string[],
    subscribedAfter: [] as number[]
  };
  let runCounter = 0;
  let failNextStart: Error | null = null;

  const api: AgentApi = {
    async startAgentRun(prompt, sessionId) {
      calls.start.push({ prompt, sessionId });
      if (failNextStart) {
        const error = failNextStart;
        failNextStart = null;
        throw error;
      }
      seq = 0;
      const snapshot: AgentRunSnapshot = {
        id: `run-${++runCounter}`,
        status: "running",
        prompt,
        sessionId,
        createdAt: "2026-11-08T10:00:00.000Z",
        events: [{ type: "status", status: "running", seq: seq++, at: "2026-11-08T10:00:00.000Z" }]
      };
      return snapshot;
    },
    subscribeToAgentRun(_runId, after, streamHandlers) {
      calls.subscribedAfter.push(after);
      handlers = streamHandlers;
      return () => {
        handlers = null;
      };
    },
    async decideAgentApproval(runId, approvalId, decision) {
      calls.decisions.push({ runId, approvalId, behavior: decision.behavior });
      return { ok: true };
    },
    async cancelAgentRun(runId) {
      calls.cancelled.push(runId);
      return { ok: true };
    }
  };

  return {
    api,
    calls,
    emit(...bodies: AgentEventBody[]) {
      for (const body of bodies) handlers?.onEvent({ ...body, seq: seq++, at: "2026-11-08T10:00:01.000Z" } as AgentEvent);
    },
    replay(event: AgentEvent) {
      handlers?.onEvent(event);
    },
    end() {
      handlers?.onEnd();
    },
    lose() {
      handlers?.onError();
    },
    failNextStart(error: Error) {
      failNextStart = error;
    }
  };
}
