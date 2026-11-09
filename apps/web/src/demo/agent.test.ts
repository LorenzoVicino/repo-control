import { describe, expect, it, vi } from "vitest";
import { createProjectFixture } from "../test/projectFixture";
import type { AgentEvent } from "../types/agent";
import type { ProjectSummary } from "../types/projects";
import { createDemoAgent } from "./agent";

function setup(projects: ProjectSummary[]) {
  const runGitAction = vi.fn(async (projectId: string, action: "pull" | "push") => {
    const project = projects.find((candidate) => candidate.id === projectId)!;
    if (action === "pull") project.behind = 0;
    else project.ahead = 0;
    return { ok: true, output: "Simulated operation completed." };
  });
  const agent = createDemoAgent({ listProjects: () => projects, runGitAction, pace: 0 });
  return { agent, runGitAction };
}

function follow(agent: ReturnType<typeof createDemoAgent>, runId: string) {
  const events: AgentEvent[] = [];
  const approvals: string[] = [];
  const ended = new Promise<void>((resolve) =>
    agent.subscribe(runId, -1, {
      onEvent: (event) => {
        events.push(event);
        if (event.type === "approval_request") approvals.push(event.approvalId);
      },
      onEnd: resolve,
      onError: () => resolve()
    })
  );
  const nextApproval = async () => {
    await vi.waitFor(() => expect(approvals.length).toBeGreaterThan(0));
    return approvals.shift()!;
  };
  return { events, ended, nextApproval };
}

const texts = (events: AgentEvent[]) => events.flatMap((event) => (event.type === "text" ? [event.text] : []));

describe("demo agent", () => {
  it("triages the demo workspace and pulls the safe repository once approved", async () => {
    const projects = [
      createProjectFixture("documentation", { behind: 1 }),
      createProjectFixture("design-system", { ahead: 1 }),
      createProjectFixture("atlas-api", { isClean: false, modified: 1 }),
      createProjectFixture("mobile-client", { isClean: false, untracked: 1 }),
      createProjectFixture("shared-utils")
    ];
    const { agent, runGitAction } = setup(projects);
    expect(agent.status()).toEqual({ available: true, command: "claude", model: "demo replay" });

    const run = agent.start("What needs me today?");
    expect(run.events.map((event) => event.type)).toEqual(["status"]);
    const { events, ended, nextApproval } = follow(agent, run.id);

    const approvalId = await nextApproval();
    expect(agent.decide(run.id, "wrong-id", { behavior: "allow" })).toBe(false);
    expect(agent.decide(run.id, approvalId, { behavior: "allow" })).toBe(true);
    await ended;

    expect(runGitAction).toHaveBeenCalledWith("documentation", "pull");
    expect(events.filter((event) => event.type === "tool_call").map((event) => event.type === "tool_call" && event.name)).toEqual(["list_repositories", "git_diff", "git_pull"]);
    expect(texts(events)[0]).toMatch(/^4 of 5 repositories need attention\./);
    expect(texts(events)[0]).toMatch(/\*\*Safe to do now\*\*\n- \*\*documentation\*\*/);
    expect(texts(events)[0]).toMatch(/\*\*Can wait\*\*\n- \*\*mobile-client\*\*/);
    expect(texts(events).at(-1)).toBe("documentation is up to date now. Want me to push design-system next?");
    expect(events.some((event) => event.type === "text_delta")).toBe(true);
    expect(events.at(-2)).toMatchObject({ type: "result", ok: true, costUsd: null, turns: 4 });
    expect(events.at(-1)).toMatchObject({ type: "status", status: "completed" });
    expect(events.map((event) => event.seq)).toEqual(events.map((_, index) => index));
  });

  it("routes a prompt naming a repository to push, pull or review, and respects a deny", async () => {
    const projects = [createProjectFixture("design-system", { ahead: 1 }), createProjectFixture("atlas-web", { isClean: false, staged: 1 }), createProjectFixture("atlas", { behind: 2 })];
    const { agent, runGitAction } = setup(projects);

    const pushRun = agent.start("Push design-system please");
    const push = follow(agent, pushRun.id);
    agent.decide(pushRun.id, await push.nextApproval(), { behavior: "deny" });
    await push.ended;
    expect(runGitAction).not.toHaveBeenCalled();
    expect(texts(push.events).at(-1)).toBe("Understood, nothing was pushed.");
    expect(push.events.find((event) => event.type === "approval_resolved")).toMatchObject({ behavior: "deny", reason: "user" });

    const reviewRun = agent.start("what changed in atlas-web?");
    const review = follow(agent, reviewRun.id);
    await review.ended;
    expect(review.events.filter((event) => event.type === "approval_request")).toHaveLength(0);
    expect(texts(review.events).at(-1)).toMatch(/docs: document the getting-started workflow/);

    const pullRun = agent.start("pull atlas");
    const pull = follow(agent, pullRun.id);
    agent.decide(pullRun.id, await pull.nextApproval(), { behavior: "allow" });
    await pull.ended;
    expect(runGitAction).toHaveBeenCalledWith("atlas", "pull");
    expect(texts(pull.events).at(-1)).toBe("Pulled atlas. It is in sync with origin/main now.");
  });

  it("stops a run that waits for approval and replays finished runs to late subscribers", async () => {
    const { agent } = setup([createProjectFixture("documentation", { behind: 1 })]);
    const run = agent.start("pull documentation");
    const live = follow(agent, run.id);
    await live.nextApproval();
    expect(agent.cancel(run.id)).toBe(true);
    await live.ended;
    expect(live.events.at(-1)).toMatchObject({ type: "status", status: "cancelled" });
    expect(live.events.find((event) => event.type === "approval_resolved")).toMatchObject({ behavior: "deny", reason: "cancelled" });
    expect(agent.cancel(run.id)).toBe(false);

    const late = follow(agent, run.id);
    await late.ended;
    expect(late.events.map((event) => event.seq)).toEqual(live.events.map((event) => event.seq));

    const missing = follow(agent, "nope");
    await missing.ended;
    expect(missing.events).toEqual([]);
  });

  it("says so when nothing needs attention", async () => {
    const { agent } = setup([createProjectFixture("clean")]);
    const run = agent.start("anything to do?");
    const { events, ended } = follow(agent, run.id);
    await ended;
    expect(texts(events)).toEqual(["All 1 repositories are clean and in sync. Nothing needs you right now."]);
  });
});
