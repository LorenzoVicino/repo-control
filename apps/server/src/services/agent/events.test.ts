import assert from "node:assert/strict";
import test from "node:test";
import { displayToolName, parseStreamJsonLine } from "./events.js";

const line = (value: unknown) => JSON.stringify(value);

test("stream-json lines become dashboard events", () => {
  assert.deepEqual(
    parseStreamJsonLine(
      line({ type: "system", subtype: "init", session_id: "s-1", model: "claude-sonnet-5-5", tools: ["mcp__repo-control__git_log", "mcp__other__x"] })
    ),
    [{ type: "session", sessionId: "s-1", model: "claude-sonnet-5-5", tools: ["git_log", "mcp__other__x"] }]
  );

  assert.deepEqual(
    parseStreamJsonLine(line({ type: "stream_event", event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hel" } } })),
    [{ type: "text_delta", text: "Hel" }]
  );
  assert.deepEqual(parseStreamJsonLine(line({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "input_json_delta", partial_json: "{" } } })), []);

  assert.deepEqual(
    parseStreamJsonLine(
      line({
        type: "assistant",
        message: {
          content: [
            { type: "thinking", thinking: "…" },
            { type: "text", text: "Checking atlas-api." },
            { type: "text", text: "  " },
            { type: "tool_use", id: "tu-1", name: "mcp__repo-control__get_repository", input: { repository: "atlas-api" } }
          ]
        }
      })
    ),
    [
      { type: "text", text: "Checking atlas-api." },
      { type: "tool_call", toolUseId: "tu-1", name: "get_repository", input: { repository: "atlas-api" } }
    ]
  );

  assert.deepEqual(
    parseStreamJsonLine(
      line({
        type: "user",
        message: {
          content: [
            { type: "tool_result", tool_use_id: "tu-1", content: [{ type: "text", text: "atlas-api on main" }, { type: "image" }] },
            { type: "tool_result", tool_use_id: "tu-2", content: "boom", is_error: true }
          ]
        }
      })
    ),
    [
      { type: "tool_result", toolUseId: "tu-1", isError: false, text: "atlas-api on main" },
      { type: "tool_result", toolUseId: "tu-2", isError: true, text: "boom" }
    ]
  );

  assert.deepEqual(
    parseStreamJsonLine(line({ type: "result", subtype: "success", is_error: false, result: "Done.", session_id: "s-1", total_cost_usd: 0.01, duration_ms: 900, num_turns: 3 })),
    [{ type: "result", ok: true, text: "Done.", sessionId: "s-1", costUsd: 0.01, durationMs: 900, turns: 3 }]
  );
  assert.deepEqual(
    parseStreamJsonLine(line({ type: "result", subtype: "error_max_turns", errors: ["Reached the turn limit"], session_id: "s-1" })),
    [{ type: "result", ok: false, text: "Reached the turn limit", sessionId: "s-1", costUsd: null, durationMs: null, turns: null }]
  );
});

test("lines the dashboard does not understand are ignored instead of breaking a run", () => {
  for (const input of [
    "not json",
    "[]",
    "null",
    line({ type: "rate_limit_event" }),
    line({ type: "system", subtype: "hook_started" }),
    line({ type: "system", subtype: "init" }),
    line({ type: "assistant", message: { content: "text" } }),
    line({ type: "assistant", parent_tool_use_id: "task-1", message: { content: [{ type: "text", text: "sub-agent chatter" }] } })
  ]) {
    assert.deepEqual(parseStreamJsonLine(input), [], input);
  }
  assert.equal(displayToolName("Bash"), "Bash");
});
