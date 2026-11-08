import type { AgentEvent, AgentRunStatus } from "../../types/agent";

// Turns the flat event list of one agent run into the blocks the conversation renders:
// groups of tool calls, finished text, the text still streaming, approval cards, errors
// and the closing summary. Pure, so the whole rendering contract is testable without a
// browser or a server.

export type ToolActivity = {
  toolUseId: string;
  name: string;
  input: unknown;
  result: { isError: boolean; text: string } | null;
};

export type ApprovalState = "pending" | "allowed" | "denied" | "expired" | "cancelled";

export type TurnBlock =
  | { kind: "activity"; key: string; tools: ToolActivity[] }
  | { kind: "text"; key: string; text: string; streaming: boolean }
  | { kind: "approval"; key: string; approvalId: string; toolName: string; title: string; input: Record<string, unknown>; state: ApprovalState }
  | { kind: "error"; key: string; message: string };

export type TurnSummary = { ok: boolean; costUsd: number | null; durationMs: number | null; turns: number | null };

export type TurnView = {
  blocks: TurnBlock[];
  status: AgentRunStatus;
  summary: TurnSummary | null;
  sessionId: string | null;
  toolCount: number;
  /** Repositories the agent looked at or acted on, in order of first mention. */
  repositories: string[];
  pendingApprovals: number;
};

function approvalState(behavior: "allow" | "deny", reason: "user" | "timeout" | "cancelled"): ApprovalState {
  if (behavior === "allow") return "allowed";
  if (reason === "timeout") return "expired";
  if (reason === "cancelled") return "cancelled";
  return "denied";
}

export function buildTurnView(events: readonly AgentEvent[]): TurnView {
  const blocks: TurnBlock[] = [];
  const tools = new Map<string, ToolActivity>();
  const approvals = new Map<string, Extract<TurnBlock, { kind: "approval" }>>();
  const repositories: string[] = [];
  let status: AgentRunStatus = "running";
  let summary: TurnSummary | null = null;
  let sessionId: string | null = null;
  let streaming = "";
  let currentActivity: Extract<TurnBlock, { kind: "activity" }> | null = null;

  const noteRepository = (input: unknown) => {
    const repository = typeof input === "object" && input !== null ? (input as Record<string, unknown>).repository : undefined;
    if (typeof repository === "string" && repository && !repositories.includes(repository)) repositories.push(repository);
  };

  for (const event of events) {
    switch (event.type) {
      case "session":
        sessionId = event.sessionId;
        break;
      case "text_delta":
        streaming += event.text;
        break;
      case "text":
        // The full block replaces the deltas that streamed it.
        streaming = "";
        currentActivity = null;
        blocks.push({ kind: "text", key: `text-${event.seq}`, text: event.text, streaming: false });
        break;
      case "tool_call": {
        streaming = "";
        const activity: ToolActivity = { toolUseId: event.toolUseId, name: event.name, input: event.input, result: null };
        tools.set(event.toolUseId, activity);
        noteRepository(event.input);
        if (!currentActivity) {
          currentActivity = { kind: "activity", key: `activity-${event.seq}`, tools: [] };
          blocks.push(currentActivity);
        }
        currentActivity.tools.push(activity);
        break;
      }
      case "tool_result": {
        const activity = tools.get(event.toolUseId);
        if (activity) activity.result = { isError: event.isError, text: event.text };
        break;
      }
      case "approval_request": {
        currentActivity = null;
        noteRepository(event.input);
        const block = {
          kind: "approval" as const,
          key: `approval-${event.approvalId}`,
          approvalId: event.approvalId,
          toolName: event.toolName,
          title: event.title,
          input: event.input,
          state: "pending" as ApprovalState
        };
        approvals.set(event.approvalId, block);
        blocks.push(block);
        break;
      }
      case "approval_resolved": {
        const block = approvals.get(event.approvalId);
        if (block) block.state = approvalState(event.behavior, event.reason);
        break;
      }
      case "result":
        summary = { ok: event.ok, costUsd: event.costUsd, durationMs: event.durationMs, turns: event.turns };
        sessionId = event.sessionId ?? sessionId;
        // A failed run often has no closing text; its message is the explanation.
        if (!event.ok && event.text && !blocks.some((block) => block.kind === "text" && block.text === event.text)) {
          blocks.push({ kind: "error", key: `result-${event.seq}`, message: event.text });
        }
        break;
      case "error":
        blocks.push({ kind: "error", key: `error-${event.seq}`, message: event.message });
        break;
      case "status":
        status = event.status;
        break;
    }
  }

  if (streaming && status === "running") blocks.push({ kind: "text", key: "streaming", text: streaming, streaming: true });

  return {
    blocks,
    status,
    summary,
    sessionId,
    toolCount: tools.size,
    repositories,
    pendingApprovals: [...approvals.values()].filter((block) => block.state === "pending").length
  };
}

/** A one-line description of a tool's input for the activity list. */
export function describeToolInput(input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const entries = Object.entries(input as Record<string, unknown>).filter(([, value]) => value !== undefined && value !== "" && value !== false);
  return entries
    .map(([key, value]) => (key === "repository" ? String(value) : `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`))
    .join(" · ");
}

/** The first meaningful line of a tool result, for the activity list. */
export function summarizeToolResult(text: string): string {
  const line = text.split("\n").find((candidate) => candidate.trim()) ?? "";
  return line.length > 90 ? `${line.slice(0, 89)}…` : line;
}
