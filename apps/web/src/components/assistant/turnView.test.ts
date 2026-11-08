import { describe, expect, it } from "vitest";
import type { AgentEvent, AgentEventBody } from "../../types/agent";
import { buildTurnView, describeToolInput, summarizeToolResult } from "./turnView";

function events(...bodies: AgentEventBody[]): AgentEvent[] {
  return bodies.map((body, seq) => ({ ...body, seq, at: "2026-11-08T10:00:00.000Z" }) as AgentEvent);
}

describe("buildTurnView", () => {
  it("groups tool calls, replaces streamed text with the final block and tracks approvals", () => {
    const view = buildTurnView(
      events(
        { type: "status", status: "running" },
        { type: "session", sessionId: "s-1", model: "haiku", tools: [] },
        { type: "tool_call", toolUseId: "a", name: "get_repository", input: { repository: "atlas-api" } },
        { type: "tool_call", toolUseId: "b", name: "git_diff", input: { repository: "atlas-api" } },
        { type: "tool_result", toolUseId: "a", isError: false, text: "atlas-api on main\nmore" },
        { type: "text_delta", text: "I will " },
        { type: "text_delta", text: "commit." },
        { type: "text", text: "I will commit." },
        { type: "tool_call", toolUseId: "c", name: "git_commit", input: { repository: "atlas-api", message: "Fix" } },
        { type: "approval_request", approvalId: "p-1", toolName: "git_commit", title: "Commit", input: { repository: "atlas-api", message: "Fix" } }
      )
    );

    expect(view.blocks.map((block) => block.kind)).toEqual(["activity", "text", "activity", "approval"]);
    const [first] = view.blocks;
    expect(first.kind === "activity" && first.tools.map((tool) => [tool.name, tool.result?.text ?? null])).toEqual([
      ["get_repository", "atlas-api on main\nmore"],
      ["git_diff", null]
    ]);
    expect(view.sessionId).toBe("s-1");
    expect(view.toolCount).toBe(3);
    expect(view.repositories).toEqual(["atlas-api"]);
    expect(view.pendingApprovals).toBe(1);
    expect(view.status).toBe("running");
  });

  it("shows deltas that have no final block yet as streaming text, only while running", () => {
    const streaming = events({ type: "status", status: "running" }, { type: "text_delta", text: "Look" }, { type: "text_delta", text: "ing…" });
    expect(buildTurnView(streaming).blocks).toEqual([{ kind: "text", key: "streaming", text: "Looking…", streaming: true }]);
    expect(buildTurnView([...streaming, ...events({ type: "status", status: "cancelled" }).map((event) => ({ ...event, seq: 9 }))]).blocks).toEqual([]);
  });

  it("maps approval outcomes and the closing result", () => {
    const view = buildTurnView(
      events(
        { type: "approval_request", approvalId: "1", toolName: "git_push", title: "Push", input: {} },
        { type: "approval_request", approvalId: "2", toolName: "git_pull", title: "Pull", input: {} },
        { type: "approval_request", approvalId: "3", toolName: "compose_up", title: "Start", input: {} },
        { type: "approval_request", approvalId: "4", toolName: "git_commit", title: "Commit", input: {} },
        { type: "approval_resolved", approvalId: "1", behavior: "allow", reason: "user" },
        { type: "approval_resolved", approvalId: "2", behavior: "deny", reason: "user" },
        { type: "approval_resolved", approvalId: "3", behavior: "deny", reason: "timeout" },
        { type: "approval_resolved", approvalId: "4", behavior: "deny", reason: "cancelled" },
        { type: "result", ok: true, text: "Done.", sessionId: "s-2", costUsd: 0.01, durationMs: 1200, turns: 3 },
        { type: "status", status: "completed" }
      )
    );
    expect(view.blocks.map((block) => (block.kind === "approval" ? block.state : block.kind))).toEqual(["allowed", "denied", "expired", "cancelled"]);
    expect(view.summary).toEqual({ ok: true, costUsd: 0.01, durationMs: 1200, turns: 3 });
    expect(view.sessionId).toBe("s-2");
    expect(view.pendingApprovals).toBe(0);
  });

  it("turns errors and failed results into error blocks", () => {
    const view = buildTurnView(
      events(
        { type: "error", message: "Claude Code was not found" },
        { type: "result", ok: false, text: "Reached the turn limit", sessionId: null, costUsd: null, durationMs: null, turns: null },
        { type: "status", status: "failed" }
      )
    );
    expect(view.blocks).toEqual([
      { kind: "error", key: "error-0", message: "Claude Code was not found" },
      { kind: "error", key: "result-1", message: "Reached the turn limit" }
    ]);
  });
});

describe("tool formatting", () => {
  it("describes inputs with the repository first and skips empty values", () => {
    expect(describeToolInput({ repository: "atlas-api", message: "Fix", stageAll: true, path: "", remote: false })).toBe("atlas-api · message: Fix · stageAll: true");
    expect(describeToolInput(null)).toBe("");
  });

  it("summarizes a result by its first non-empty line", () => {
    expect(summarizeToolResult("\n\natlas-api on main\nrest")).toBe("atlas-api on main");
    expect(summarizeToolResult("x".repeat(120))).toHaveLength(90);
  });
});
