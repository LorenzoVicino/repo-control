import { describe, expect, it } from "vitest";
import { createConversationStore } from "./conversationStore";
import { createFakeAgentApi } from "../../test/fakeAgentApi";

const messages = { startFailed: "start failed", streamLost: "stream lost", decisionFailed: "decision failed", cancelFailed: "cancel failed" };

describe("conversation store", () => {
  it("runs turns in one Claude Code session and ignores replayed events", async () => {
    const fake = createFakeAgentApi();
    const store = createConversationStore(fake.api);

    await store.send("  What needs me?  ", messages);
    expect(store.getSnapshot().busy).toBe(true);
    expect(fake.calls.start).toEqual([{ prompt: "What needs me?", sessionId: null }]);
    expect(fake.calls.subscribedAfter).toEqual([0]);

    fake.emit({ type: "session", sessionId: "s-1", model: null, tools: [] });
    const [, session] = store.getSnapshot().turns[0].events;
    fake.replay(session);
    fake.emit({ type: "result", ok: true, text: "Done", sessionId: "s-1", costUsd: 0, durationMs: 1, turns: 1 }, { type: "status", status: "completed" });
    fake.end();

    const state = store.getSnapshot();
    expect(state.busy).toBe(false);
    expect(state.sessionId).toBe("s-1");
    expect(state.turns[0].events.map((event) => event.type)).toEqual(["status", "session", "result", "status"]);

    await store.send("And now?", messages);
    expect(fake.calls.start[1]).toEqual({ prompt: "And now?", sessionId: "s-1" });

    await store.send("ignored while busy", messages);
    await store.send("   ", messages);
    expect(fake.calls.start).toHaveLength(2);

    await store.stop(messages.cancelFailed);
    expect(fake.calls.cancelled).toEqual(["run-2"]);
    await store.decide("run-2", "p-1", { behavior: "allow" }, messages.decisionFailed);
    expect(fake.calls.decisions).toEqual([{ runId: "run-2", approvalId: "p-1", behavior: "allow" }]);

    store.reset();
    expect(store.getSnapshot()).toEqual({ sessionId: null, turns: [], busy: false });
  });

  it("records a start failure or a lost stream on the turn and frees the composer", async () => {
    const fake = createFakeAgentApi();
    const store = createConversationStore(fake.api);

    fake.failNextStart(new Error("The agent is already handling a request."));
    await store.send("hi", messages);
    expect(store.getSnapshot().turns[0].error).toBe("The agent is already handling a request.");
    expect(store.getSnapshot().busy).toBe(false);

    await store.send("again", messages);
    fake.lose();
    expect(store.getSnapshot().turns[1].error).toBe("stream lost");
    expect(store.getSnapshot().busy).toBe(false);
  });

  it("notifies subscribers on every change", async () => {
    const fake = createFakeAgentApi();
    const store = createConversationStore(fake.api);
    let notifications = 0;
    const unsubscribe = store.subscribe(() => (notifications += 1));
    await store.send("hi", messages);
    unsubscribe();
    const seen = notifications;
    fake.emit({ type: "text", text: "Hello" });
    expect(seen).toBeGreaterThan(0);
    expect(notifications).toBe(seen);
  });
});
