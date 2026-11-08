// What the dashboard sees of an agent run: a flat, append-only list of events derived from
// Claude Code's stream-json output plus the approvals repo-control raises itself. Each event
// carries a sequence number so a reconnecting client can resume where it stopped.

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

export const MCP_SERVER_NAME = "repo-control";
const MCP_TOOL_PREFIX = `mcp__${MCP_SERVER_NAME}__`;

/** `mcp__repo-control__git_push` → `git_push`; other names are left as they are. */
export function displayToolName(name: string): string {
  return name.startsWith(MCP_TOOL_PREFIX) ? name.slice(MCP_TOOL_PREFIX.length) : name;
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);
const asNumber = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

function toolResultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => (isObject(part) && part.type === "text" ? (asString(part.text) ?? "") : ""))
    .filter(Boolean)
    .join("\n");
}

/**
 * Translates one line of `claude -p --output-format stream-json` into dashboard events.
 * Unknown or malformed lines produce nothing: the CLI adds message types over time, and a
 * line the dashboard does not understand must never break a run.
 */
export function parseStreamJsonLine(line: string): AgentEventBody[] {
  let message: unknown;
  try {
    message = JSON.parse(line);
  } catch {
    return [];
  }
  if (!isObject(message)) return [];

  // Sub-agent traffic is not part of the conversation the user is having.
  if (message.parent_tool_use_id) return [];

  switch (message.type) {
    case "system": {
      if (message.subtype !== "init") return [];
      const sessionId = asString(message.session_id);
      if (!sessionId) return [];
      const tools = Array.isArray(message.tools) ? message.tools.filter((tool): tool is string => typeof tool === "string").map(displayToolName) : [];
      return [{ type: "session", sessionId, model: asString(message.model), tools }];
    }

    case "stream_event": {
      const event = message.event;
      if (!isObject(event) || event.type !== "content_block_delta" || !isObject(event.delta)) return [];
      const text = event.delta.type === "text_delta" ? asString(event.delta.text) : null;
      return text ? [{ type: "text_delta", text }] : [];
    }

    case "assistant": {
      const content = isObject(message.message) && Array.isArray(message.message.content) ? message.message.content : [];
      const events: AgentEventBody[] = [];
      for (const block of content) {
        if (!isObject(block)) continue;
        if (block.type === "text" && asString(block.text)?.trim()) events.push({ type: "text", text: block.text as string });
        if (block.type === "tool_use" && asString(block.id) && asString(block.name)) {
          events.push({ type: "tool_call", toolUseId: block.id as string, name: displayToolName(block.name as string), input: block.input ?? {} });
        }
      }
      return events;
    }

    case "user": {
      const content = isObject(message.message) && Array.isArray(message.message.content) ? message.message.content : [];
      return content.flatMap((block): AgentEventBody[] =>
        isObject(block) && block.type === "tool_result" && asString(block.tool_use_id)
          ? [{ type: "tool_result", toolUseId: block.tool_use_id as string, isError: block.is_error === true, text: toolResultText(block.content) }]
          : []
      );
    }

    case "result":
      return [
        {
          type: "result",
          ok: message.subtype === "success" && message.is_error !== true,
          text: asString(message.result) ?? (Array.isArray(message.errors) ? message.errors.filter((error) => typeof error === "string").join("\n") : ""),
          sessionId: asString(message.session_id),
          costUsd: asNumber(message.total_cost_usd),
          durationMs: asNumber(message.duration_ms),
          turns: asNumber(message.num_turns)
        }
      ];

    default:
      return [];
  }
}
