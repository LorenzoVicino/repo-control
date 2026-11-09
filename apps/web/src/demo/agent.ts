import type { AgentApprovalDecision, AgentEvent, AgentEventBody, AgentRunSnapshot } from "../types/agent";
import type { ProjectSummary } from "../types/projects";

// The online demo has no Claude Code behind it, so the agent replays scripted conversations
// built from the demo workspace as it is at that moment. The scripts call the same tools the
// real agent would, stream their answers, and stop at a real approval card: approving a pull
// or a push changes the demo repository for the rest of the browser session, exactly as the
// dashboard's own buttons do. Nothing leaves the page.

type StreamHandlers = { onEvent: (event: AgentEvent) => void; onEnd: () => void; onError: () => void };

type DemoRun = {
  id: string;
  prompt: string;
  events: AgentEvent[];
  listeners: Set<StreamHandlers>;
  finished: boolean;
  cancelled: boolean;
  approval: { id: string; resolve: (behavior: "allow" | "deny") => void } | null;
  wake: (() => void) | null;
};

export type DemoAgentDependencies = {
  listProjects: () => ProjectSummary[];
  /** Applies a Git action to the demo workspace; resolves to the command output. */
  runGitAction: (projectId: string, action: "pull" | "push") => Promise<{ ok: boolean; output: string }>;
  /** How a repository relates to the others, for questions about what a change would affect. */
  relationsOf?: (projectName: string) => { usedBy: Array<{ name: string; evidence: string }>; mentionedBy: Array<{ name: string; evidence: string }> };
  /** Milliseconds between streamed chunks; tests pass 0. */
  pace?: number;
};

const TOOL_TITLES: Record<string, string> = { git_pull: "Pull (fast-forward only)", git_push: "Push" };

class Cancelled extends Error {}

export function createDemoAgent({ listProjects, runGitAction, relationsOf, pace = 1 }: DemoAgentDependencies) {
  const runs = new Map<string, DemoRun>();
  let counter = 0;

  function emit(run: DemoRun, body: AgentEventBody) {
    const event = { ...body, seq: run.events.length, at: new Date().toISOString() } as AgentEvent;
    run.events.push(event);
    for (const listener of run.listeners) listener.onEvent(event);
  }

  function sleep(run: DemoRun, ms: number): Promise<void> {
    if (run.cancelled) return Promise.reject(new Cancelled());
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        run.wake = null;
        if (run.cancelled) reject(new Cancelled());
        else resolve();
      }, ms * pace);
      run.wake = () => {
        clearTimeout(timer);
        reject(new Cancelled());
      };
    });
  }

  async function say(run: DemoRun, text: string) {
    // Stream a few words at a time, then the full block, as Claude Code's partial messages do.
    const words = text.split(/(?<=\s)/);
    for (let index = 0; index < words.length; index += 3) {
      emit(run, { type: "text_delta", text: words.slice(index, index + 3).join("") });
      await sleep(run, 28);
    }
    emit(run, { type: "text", text });
    await sleep(run, 120);
  }

  let toolCounter = 0;
  async function tool(run: DemoRun, name: string, input: Record<string, unknown>, result: string, isError = false) {
    const toolUseId = `demo-tool-${++toolCounter}`;
    emit(run, { type: "tool_call", toolUseId, name, input });
    await sleep(run, 420);
    emit(run, { type: "tool_result", toolUseId, isError, text: result });
    await sleep(run, 160);
    return toolUseId;
  }

  async function write(run: DemoRun, project: ProjectSummary, action: "pull" | "push"): Promise<boolean> {
    const name = `git_${action}`;
    const input = { repository: project.name };
    const toolUseId = `demo-tool-${++toolCounter}`;
    emit(run, { type: "tool_call", toolUseId, name, input });
    await sleep(run, 200);
    const approvalId = `demo-approval-${toolCounter}`;
    const behavior = await new Promise<"allow" | "deny">((resolve) => {
      run.approval = { id: approvalId, resolve };
      emit(run, { type: "approval_request", approvalId, toolName: name, title: TOOL_TITLES[name], input });
    });
    run.approval = null;
    if (run.cancelled) throw new Cancelled();
    emit(run, { type: "approval_resolved", approvalId, behavior, reason: "user" });
    if (behavior === "deny") {
      emit(run, { type: "tool_result", toolUseId, isError: true, text: "The user declined this action." });
      await sleep(run, 200);
      return false;
    }
    await sleep(run, 500);
    const outcome = await runGitAction(project.id, action);
    emit(run, {
      type: "tool_result",
      toolUseId,
      isError: !outcome.ok,
      text: `git ${action === "pull" ? "pull --ff-only" : "push"} in ${project.name} ${outcome.ok ? "succeeded" : "failed"}.\n${outcome.output}`
    });
    await sleep(run, 200);
    return outcome.ok;
  }

  const stateOf = (project: ProjectSummary) => {
    const parts = [
      project.staged && `${project.staged} staged`,
      project.modified && `${project.modified} modified`,
      project.untracked && `${project.untracked} untracked`,
      project.ahead && `${project.ahead} ahead`,
      project.behind && `${project.behind} behind`
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : "clean and in sync";
  };
  const needsAttention = (project: ProjectSummary) => !project.isClean || project.ahead > 0 || project.behind > 0;

  async function triage(run: DemoRun) {
    const projects = listProjects();
    const attention = projects.filter(needsAttention);
    await tool(
      run,
      "list_repositories",
      { state: "needs-attention" },
      `${attention.length} of ${projects.length} repositories (needs-attention).\n${attention.map((project) => `- ${project.name} on ${project.branch} → ${project.upstream}: ${stateOf(project)}`).join("\n")}`
    );
    const dirty = attention.filter((project) => !project.isClean);
    if (dirty[0]) {
      await tool(run, "git_diff", { repository: dirty[0].name }, `${dirty[0].name}\nStaged:\n  ${dirty[0].staged ? "README.md | 1 +" : "none"}\nUnstaged:\n  ${dirty[0].modified ? "README.md | 1 +" : "none"}`);
    }

    const pullable = attention.filter((project) => project.behind > 0 && project.isClean);
    const pushable = attention.filter((project) => project.ahead > 0);
    const safe = [
      ...pullable.map((project) => `- **${project.name}**: ${project.behind} commit behind with a clean tree, so a fast-forward pull is safe.`),
      ...pushable.map((project) => `- **${project.name}**: ${project.ahead} local commit not pushed yet.`)
    ];
    const needsYou = dirty.filter((project) => project.staged || project.modified).map((project) => `- **${project.name}**: ${project.staged ? "staged changes waiting for a commit message" : "modified files to review"}.`);
    const canWait = dirty.filter((project) => !project.staged && !project.modified).map((project) => `- **${project.name}**: only untracked files, nothing staged.`);

    if (!attention.length) {
      await say(run, `All ${projects.length} repositories are clean and in sync. Nothing needs you right now.`);
      return;
    }
    await say(
      run,
      [
        `${attention.length} of ${projects.length} repositories need attention.`,
        safe.length ? `\n**Safe to do now**\n${safe.join("\n")}` : "",
        needsYou.length ? `\n**Needs you**\n${needsYou.join("\n")}` : "",
        canWait.length ? `\n**Can wait**\n${canWait.join("\n")}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    );
    if (pullable[0]) {
      await say(run, `I'll start with the safe one: pulling ${pullable[0].name}.`);
      const done = await write(run, pullable[0], "pull");
      await say(run, done ? `${pullable[0].name} is up to date now.${pushable[0] ? ` Want me to push ${pushable[0].name} next?` : ""}` : `Understood, I left ${pullable[0].name} as it is.`);
    }
  }

  async function pull(run: DemoRun, project: ProjectSummary) {
    await tool(run, "get_repository", { repository: project.name }, `${project.name} on ${project.branch} → ${project.upstream}: ${stateOf(project)}.`);
    if (!project.behind) return say(run, `${project.name} is already up to date with ${project.upstream}; there is nothing to pull.`);
    if (!project.isClean) return say(run, `${project.name} has local changes, so I won't pull it: commit or stash them first.`);
    await say(run, `${project.name} is ${project.behind} commit behind and its working tree is clean, so a fast-forward is safe.`);
    const done = await write(run, project, "pull");
    await say(run, done ? `Pulled ${project.name}. It is in sync with ${project.upstream} now.` : `Understood, I left ${project.name} as it is.`);
  }

  async function push(run: DemoRun, project: ProjectSummary) {
    await tool(run, "git_log", { repository: project.name, limit: 5 }, `${project.name}, commits 1–1:\n${project.lastCommit?.hash} ${project.lastCommit?.message}`);
    if (!project.ahead) return say(run, `${project.name} has no local commits to push.`);
    await say(run, `${project.name} has ${project.ahead} commit that has not reached ${project.upstream}: \`${project.lastCommit?.message}\`.`);
    const done = await write(run, project, "push");
    await say(run, done ? `Pushed ${project.name}.` : `Understood, nothing was pushed.`);
  }

  async function review(run: DemoRun, project: ProjectSummary) {
    await tool(
      run,
      "git_diff",
      { repository: project.name },
      `${project.name}\nStaged:\n  ${project.staged ? "README.md | 1 +" : "none"}\nUnstaged:\n  ${project.modified ? "README.md | 1 +" : "none"}\nUntracked (${project.untracked}):\n  ${project.untracked ? "notes.md" : "none"}`
    );
    if (project.isClean) return say(run, `${project.name} has no uncommitted changes.`);
    await tool(run, "git_diff", { repository: project.name, path: project.untracked ? "notes.md" : "README.md" }, "+Document the getting-started workflow.");
    await say(
      run,
      `${project.name} has one change: ${project.untracked ? "a new `notes.md`" : "`README.md` gains a getting-started section"}.\n\nA commit message that fits:\n\n\`\`\`\ndocs: document the getting-started workflow\n\`\`\`\n\nTell me to commit it and I'll ask for your approval first.`
    );
  }

  async function impact(run: DemoRun, project: ProjectSummary) {
    const relations = relationsOf?.(project.name) ?? { usedBy: [], mentionedBy: [] };
    const lines = [
      `${project.name}`,
      relations.usedBy.length ? `Used by (${relations.usedBy.length}):\n${relations.usedBy.map((entry) => `  - ${entry.name}: ${entry.evidence}`).join("\n")}` : "Used by: none.",
      relations.mentionedBy.length ? `Mentioned by (${relations.mentionedBy.length}):\n${relations.mentionedBy.map((entry) => `  - ${entry.name}: ${entry.evidence}`).join("\n")}` : "Mentioned by: none."
    ];
    await tool(run, "repository_relations", { repository: project.name }, lines.join("\n"));
    if (!relations.usedBy.length && !relations.mentionedBy.length) {
      return say(run, `Nothing else in the workspace depends on or mentions ${project.name}, so a change stays local to it.`);
    }
    const dependents = relations.usedBy.map((entry) => entry.name);
    if (dependents[0]) {
      const first = listProjects().find((candidate) => candidate.name === dependents[0]);
      if (first) await tool(run, "get_repository", { repository: first.name }, `${first.name} on ${first.branch} → ${first.upstream}: ${stateOf(first)}.`);
    }
    await say(
      run,
      [
        `A change to **${project.name}** reaches ${dependents.length ? `${dependents.length} ${dependents.length === 1 ? "repository that depends" : "repositories that depend"} on it` : "no dependent repositories"}${relations.mentionedBy.length ? `, and ${relations.mentionedBy.length} more mention it` : ""}.`,
        dependents.length ? `\n**Rebuild and test**\n${relations.usedBy.map((entry) => `- **${entry.name}**: ${entry.evidence}`).join("\n")}` : "",
        relations.mentionedBy.length ? `\n**Check the docs**\n${relations.mentionedBy.map((entry) => `- **${entry.name}**: ${entry.evidence}`).join("\n")}` : "",
        dependents.length ? `\nRelease ${project.name} first, then bump it in ${dependents.join(", ")}.` : ""
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  async function script(run: DemoRun) {
    const prompt = run.prompt.toLowerCase();
    // Longest names first, so "atlas-web" is not mistaken for a shorter prefix.
    const project = [...listProjects()].sort((a, b) => b.name.length - a.name.length).find((candidate) => prompt.includes(candidate.name.toLowerCase()));
    if (project && /\b(affect|impact|depend|depends|dependent|touch|tocchere|dipend)/.test(prompt)) return impact(run, project);
    if (project && /\bpush\b/.test(prompt)) return push(run, project);
    if (project && /\bpull\b/.test(prompt)) return pull(run, project);
    if (project) return review(run, project);
    return triage(run);
  }

  function finish(run: DemoRun, status: "completed" | "cancelled", startedAt: number) {
    if (run.finished) return;
    if (status === "completed") {
      const turns = run.events.filter((event) => event.type === "tool_call").length + 1;
      emit(run, { type: "result", ok: true, text: "", sessionId: "demo", costUsd: null, durationMs: Date.now() - startedAt, turns });
    }
    run.finished = true;
    emit(run, { type: "status", status });
    for (const listener of run.listeners) listener.onEnd();
    run.listeners.clear();
  }

  return {
    status: () => ({ available: true, command: "claude", model: "demo replay" }),

    start(prompt: string): AgentRunSnapshot {
      const run: DemoRun = { id: `demo-run-${++counter}`, prompt, events: [], listeners: new Set(), finished: false, cancelled: false, approval: null, wake: null };
      runs.set(run.id, run);
      emit(run, { type: "status", status: "running" });
      const startedAt = Date.now();
      void (async () => {
        try {
          await sleep(run, 250);
          emit(run, { type: "session", sessionId: "demo", model: "demo replay", tools: [] });
          await script(run);
          finish(run, "completed", startedAt);
        } catch (error) {
          if (!(error instanceof Cancelled)) throw error;
          finish(run, "cancelled", startedAt);
        }
      })();
      return { id: run.id, status: "running", prompt, sessionId: null, createdAt: new Date().toISOString(), events: [...run.events] };
    },

    subscribe(runId: string, after: number, handlers: StreamHandlers): () => void {
      const run = runs.get(runId);
      if (!run) {
        queueMicrotask(handlers.onError);
        return () => {};
      }
      for (const event of run.events.slice(after + 1)) handlers.onEvent(event);
      if (run.finished) {
        queueMicrotask(handlers.onEnd);
        return () => {};
      }
      run.listeners.add(handlers);
      return () => run.listeners.delete(handlers);
    },

    decide(runId: string, approvalId: string, decision: AgentApprovalDecision): boolean {
      const run = runs.get(runId);
      if (!run?.approval || run.approval.id !== approvalId) return false;
      run.approval.resolve(decision.behavior);
      return true;
    },

    cancel(runId: string): boolean {
      const run = runs.get(runId);
      if (!run || run.finished) return false;
      run.cancelled = true;
      if (run.approval) {
        emit(run, { type: "approval_resolved", approvalId: run.approval.id, behavior: "deny", reason: "cancelled" });
        run.approval.resolve("deny");
      }
      run.wake?.();
      return true;
    }
  };
}

export type DemoAgent = ReturnType<typeof createDemoAgent>;
