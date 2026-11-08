// Mirrors apps/server/src/services/agent/events.ts: what the dashboard receives from an
// agent run, one sequenced event at a time.

export type AgentRunStatus = "running" | "completed" | "failed" | "cancelled";

export type AgentEventBody =
  | { type: "session"; sessionId: string; model: string | null; tools: string[] }
  | { type: "text_delta"; text: string }
  | { type: "text"; text: string }
  | { type: "tool_call"; toolUseId: string; name: string; input: unknown }
  | { type: "tool_result"; toolUseId: string; isError: boolean; text: string }
  | { type: "approval_request"; approvalId: string; toolName: string; title: string; input: Record<string, unknown> }
  | { type: "approval_resolved"; approvalId: string; behavior: "allow" | "deny"; reason: "user" | "timeout" | "cancelled" }
  | { type: "result"; ok: boolean; text: string; sessionId: string | null; costUsd: number | null; durationMs: number | null; turns: number | null }
  | { type: "error"; message: string }
  | { type: "status"; status: AgentRunStatus };

export type AgentEvent = AgentEventBody & { seq: number; at: string };

export type AgentRunSnapshot = {
  id: string;
  status: AgentRunStatus;
  prompt: string;
  sessionId: string | null;
  createdAt: string;
  events: AgentEvent[];
};

export type AgentStatus = {
  available: boolean;
  command: string;
  model: string | null;
};

export type AgentApprovalDecision = { behavior: "allow" } | { behavior: "deny"; message?: string };
