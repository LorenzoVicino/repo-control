import { cancelAgentRun, decideAgentApproval, startAgentRun, subscribeToAgentRun } from "../../api/agent";
import type { AgentApprovalDecision, AgentEvent } from "../../types/agent";

// The conversation lives outside React so it survives leaving the Agent section: a run
// keeps streaming into the store while another page is on screen, and coming back shows
// everything that happened meanwhile.

export type ConversationTurn = {
  id: string;
  prompt: string;
  runId: string | null;
  events: AgentEvent[];
  /** Set when the run could not be started or its stream was lost. */
  error: string | null;
};

export type ConversationState = {
  sessionId: string | null;
  turns: ConversationTurn[];
  busy: boolean;
};

export type AgentApi = {
  startAgentRun: typeof startAgentRun;
  subscribeToAgentRun: typeof subscribeToAgentRun;
  decideAgentApproval: typeof decideAgentApproval;
  cancelAgentRun: typeof cancelAgentRun;
};

type Messages = { startFailed: string; streamLost: string; decisionFailed: string; cancelFailed: string };

const EMPTY: ConversationState = { sessionId: null, turns: [], busy: false };

export function createConversationStore(api: AgentApi = { startAgentRun, subscribeToAgentRun, decideAgentApproval, cancelAgentRun }) {
  let state = EMPTY;
  let unsubscribe: (() => void) | null = null;
  const listeners = new Set<() => void>();
  let turnCounter = 0;

  const set = (next: ConversationState) => {
    state = next;
    for (const listener of listeners) listener();
  };
  const updateTurn = (turnId: string, update: (turn: ConversationTurn) => ConversationTurn) =>
    set({ ...state, turns: state.turns.map((turn) => (turn.id === turnId ? update(turn) : turn)) });

  function appendEvent(turnId: string, event: AgentEvent) {
    const turn = state.turns.find((candidate) => candidate.id === turnId);
    // Replays after a reconnect can repeat events; the sequence number makes them idempotent.
    if (!turn || turn.events.some((existing) => existing.seq === event.seq)) return;
    const sessionId =
      event.type === "session" ? event.sessionId : event.type === "result" && event.sessionId ? event.sessionId : state.sessionId;
    const finished = event.type === "status" && event.status !== "running";
    set({
      sessionId,
      busy: finished ? false : state.busy,
      turns: state.turns.map((candidate) => (candidate.id === turnId ? { ...candidate, events: [...candidate.events, event] } : candidate))
    });
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => state,

    async send(prompt: string, messages: Messages): Promise<void> {
      const text = prompt.trim();
      if (!text || state.busy) return;
      const turnId = `turn-${++turnCounter}`;
      set({ ...state, busy: true, turns: [...state.turns, { id: turnId, prompt: text, runId: null, events: [], error: null }] });

      try {
        const run = await api.startAgentRun(text, state.sessionId, messages.startFailed);
        updateTurn(turnId, (turn) => ({ ...turn, runId: run.id }));
        for (const event of run.events) appendEvent(turnId, event);
        const lastSeq = run.events.at(-1)?.seq ?? -1;
        unsubscribe = api.subscribeToAgentRun(run.id, lastSeq, {
          onEvent: (event) => appendEvent(turnId, event),
          onEnd: () => {
            unsubscribe = null;
            if (state.busy) set({ ...state, busy: false });
          },
          onError: () => {
            unsubscribe = null;
            updateTurn(turnId, (turn) => ({ ...turn, error: messages.streamLost }));
            set({ ...state, busy: false });
          }
        });
      } catch (error) {
        updateTurn(turnId, (turn) => ({ ...turn, error: error instanceof Error ? error.message : messages.startFailed }));
        set({ ...state, busy: false });
      }
    },

    async decide(runId: string, approvalId: string, decision: AgentApprovalDecision, fallbackMessage: string): Promise<void> {
      await api.decideAgentApproval(runId, approvalId, decision, fallbackMessage);
    },

    async stop(fallbackMessage: string): Promise<void> {
      const runId = state.turns.at(-1)?.runId;
      if (runId && state.busy) await api.cancelAgentRun(runId, fallbackMessage);
    },

    /** Starts over: the next message opens a new Claude Code session. */
    reset() {
      unsubscribe?.();
      unsubscribe = null;
      set(EMPTY);
    }
  };
}

export type ConversationStore = ReturnType<typeof createConversationStore>;

export const conversationStore = createConversationStore();
