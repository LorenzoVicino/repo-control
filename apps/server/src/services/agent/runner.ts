import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import { killProcessTree } from "../../lib/commandRunner.js";
import { shouldUseShellForCommand } from "../../runtime.js";
import type { ApprovalDecision, ApprovalRequest, McpAccessControl } from "../mcp/access.js";
import { APPROVAL_TOOL_NAME } from "../mcp/server.js";
import type { ToolDefinition } from "../tools/index.js";
import { MCP_SERVER_NAME, parseStreamJsonLine, type AgentEvent, type AgentEventBody, type AgentRunStatus } from "./events.js";

// The in-app agent is Claude Code in headless mode (`claude -p`), restricted to the
// repo-control MCP server:
// - built-in tools are disabled (--tools ""), so it cannot run commands or edit files;
// - read tools are pre-allowed;
// - every write tool goes through --permission-prompt-tool, which repo-control answers
//   with an approval card in the dashboard;
// - user and project settings are not loaded, so a permissive allow rule or permission
//   mode in ~/.claude cannot skip those approvals.
// Each run gets its own MCP token, revoked when the run ends.

export type SpawnProcess = (command: string, args: string[], options: SpawnOptions) => ChildProcess;

export type AgentRunnerOptions = {
  claudeCommand: string;
  model?: string;
  mcpUrl: () => string;
  mcpAccess: McpAccessControl;
  workspaceRoot: () => string;
  tools: ReadonlyArray<ToolDefinition>;
  spawnProcess?: SpawnProcess;
  /** Stops a run's process (tree). Injectable so tests can stand in for a real process. */
  killProcess?: (child: ChildProcess, signal: NodeJS.Signals) => void;
  approvalTimeoutMs?: number;
  maxActiveRuns?: number;
  maxStoredRuns?: number;
};

export type AgentRunSnapshot = {
  id: string;
  status: AgentRunStatus;
  prompt: string;
  sessionId: string | null;
  createdAt: string;
  events: AgentEvent[];
};

export type AgentRunListener = (event: AgentEvent) => void;

export class AgentBusyError extends Error {
  constructor(limit: number) {
    super(`The agent is already handling ${limit === 1 ? "a request" : `${limit} requests`}. Wait for it to finish or stop it.`);
    this.name = "AgentBusyError";
  }
}

type PendingApproval = { toolName: string; resolve: (decision: ApprovalDecision) => void; timer: NodeJS.Timeout };

type AgentRun = {
  id: string;
  prompt: string;
  status: AgentRunStatus;
  sessionId: string | null;
  createdAt: string;
  events: AgentEvent[];
  listeners: Set<AgentRunListener>;
  approvals: Map<string, PendingApproval>;
  child: ChildProcess | null;
  cancelled: boolean;
};

const DEFAULT_APPROVAL_TIMEOUT_MS = 10 * 60_000;
const MAX_EVENTS_PER_RUN = 20_000;
const STDERR_TAIL = 4_000;

function systemPrompt(workspaceName: string): string {
  return [
    `You are the agent inside repo-control, a local dashboard for the Git repositories in the workspace folder "${workspaceName}".`,
    "You act only through the repo-control tools. Name repositories the way list_repositories does.",
    "Inspect before you change anything: read a repository's state and diff before committing, pulling or pushing.",
    "Tools that change something (commits, pushes, pulls, branch changes, Docker Compose, workflow runs) pause for the user's approval in the dashboard.",
    "When the user has asked for a change, call the tool directly: the approval card is the confirmation, so do not ask for it in text first.",
    "If the user declines an action, do not retry it; ask what they would like instead.",
    "Answer concisely, in the language the user writes in. Use short lists for several repositories."
  ].join("\n");
}

/** Quotes an argument for cmd.exe, needed only when an npm .cmd shim has to run through a shell. */
function quoteForShell(argument: string): string {
  return /^[\w@%+=:,./\\-]+$/.test(argument) ? argument : `"${argument.replace(/"/g, '""')}"`;
}

export type AgentRunner = ReturnType<typeof createAgentRunner>;

export function createAgentRunner(options: AgentRunnerOptions) {
  const spawnProcess = options.spawnProcess ?? ((command, args, spawnOptions) => spawn(command, args, spawnOptions));
  const killProcess = options.killProcess ?? killProcessTree;
  const approvalTimeoutMs = options.approvalTimeoutMs ?? DEFAULT_APPROVAL_TIMEOUT_MS;
  const maxActiveRuns = options.maxActiveRuns ?? 1;
  const maxStoredRuns = options.maxStoredRuns ?? 20;
  const titles = new Map(options.tools.map((tool) => [tool.name, tool.title]));
  const runs = new Map<string, AgentRun>();

  function emit(run: AgentRun, body: AgentEventBody): void {
    if (run.events.length >= MAX_EVENTS_PER_RUN && body.type === "text_delta") return;
    const event = { ...body, seq: run.events.length, at: new Date().toISOString() } as AgentEvent;
    run.events.push(event);
    for (const listener of run.listeners) listener(event);
  }

  function resolveApproval(run: AgentRun, approvalId: string, decision: ApprovalDecision, reason: "user" | "timeout" | "cancelled"): boolean {
    const pending = run.approvals.get(approvalId);
    if (!pending) return false;
    run.approvals.delete(approvalId);
    clearTimeout(pending.timer);
    emit(run, { type: "approval_resolved", approvalId, behavior: decision.behavior, reason });
    pending.resolve(decision);
    return true;
  }

  function requestApproval(run: AgentRun, request: ApprovalRequest): Promise<ApprovalDecision> {
    if (run.status !== "running") return Promise.resolve({ behavior: "deny", message: "The run has ended." });
    const approvalId = randomUUID();
    return new Promise((resolve) => {
      const timer = setTimeout(
        () => resolveApproval(run, approvalId, { behavior: "deny", message: "The user did not answer in time. Do not retry; ask them instead." }, "timeout"),
        approvalTimeoutMs
      );
      run.approvals.set(approvalId, { toolName: request.toolName, resolve, timer });
      emit(run, {
        type: "approval_request",
        approvalId,
        toolName: request.toolName,
        title: titles.get(request.toolName) ?? request.toolName,
        input: request.input
      });
    });
  }

  function finish(run: AgentRun, status: AgentRunStatus): void {
    if (run.status !== "running") return;
    for (const approvalId of [...run.approvals.keys()]) {
      resolveApproval(run, approvalId, { behavior: "deny", message: "The run was stopped." }, "cancelled");
    }
    run.status = status;
    run.child = null;
    emit(run, { type: "status", status });
    run.listeners.clear();
    prune();
  }

  function prune(): void {
    const finished = [...runs.values()].filter((run) => run.status !== "running");
    for (const run of finished.slice(0, Math.max(0, finished.length - maxStoredRuns))) runs.delete(run.id);
  }

  async function start({ prompt, resumeSessionId }: { prompt: string; resumeSessionId?: string }): Promise<AgentRunSnapshot> {
    const active = [...runs.values()].filter((run) => run.status === "running").length;
    if (active >= maxActiveRuns) throw new AgentBusyError(maxActiveRuns);

    const run: AgentRun = {
      id: randomUUID(),
      prompt,
      status: "running",
      sessionId: resumeSessionId ?? null,
      createdAt: new Date().toISOString(),
      events: [],
      listeners: new Set(),
      approvals: new Map(),
      child: null,
      cancelled: false
    };
    runs.set(run.id, run);
    emit(run, { type: "status", status: "running" });

    const grant = options.mcpAccess.issueAgentToken((request) => requestApproval(run, request));
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-agent-"));
    const cleanup = () => {
      grant.revoke();
      void fs.rm(directory, { recursive: true, force: true });
    };

    try {
      const mcpConfigPath = path.join(directory, "mcp.json");
      const promptPath = path.join(directory, "system-prompt.txt");
      // The token is a credential: it goes in a file only this user can read, never on argv.
      const mcpConfig = { mcpServers: { [MCP_SERVER_NAME]: { type: "http", url: options.mcpUrl(), headers: { Authorization: `Bearer ${grant.token}` } } } };
      await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig), { mode: 0o600 });
      await fs.writeFile(promptPath, systemPrompt(path.basename(options.workspaceRoot())), { mode: 0o600 });

      const readTools = options.tools.filter((tool) => tool.effect === "read").map((tool) => `mcp__${MCP_SERVER_NAME}__${tool.name}`);
      const args = [
        "-p",
        "--output-format", "stream-json",
        "--verbose",
        "--include-partial-messages",
        "--mcp-config", mcpConfigPath,
        "--strict-mcp-config",
        "--setting-sources", "",
        "--tools", "",
        "--allowedTools", readTools.join(","),
        "--permission-prompt-tool", `mcp__${MCP_SERVER_NAME}__${APPROVAL_TOOL_NAME}`,
        "--append-system-prompt-file", promptPath,
        ...(options.model ? ["--model", options.model] : []),
        ...(resumeSessionId ? ["--resume", resumeSessionId] : [])
      ];
      const shell = shouldUseShellForCommand(options.claudeCommand);
      const child = spawnProcess(options.claudeCommand, shell ? args.map(quoteForShell) : args, {
        cwd: options.workspaceRoot(),
        shell,
        detached: process.platform !== "win32",
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          // An approval can wait for the user; the default MCP tool timeout would cut it off.
          MCP_TOOL_TIMEOUT: String(approvalTimeoutMs + 5 * 60_000)
        }
      });
      run.child = child;
      attach(run, child, cleanup);

      // The prompt goes through stdin, so it is never parsed as an option or by a shell.
      child.stdin?.on("error", () => {});
      child.stdin?.end(prompt);
    } catch (error) {
      cleanup();
      emit(run, { type: "error", message: `Could not start the agent: ${error instanceof Error ? error.message : String(error)}` });
      finish(run, "failed");
    }

    return snapshot(run);
  }

  function attach(run: AgentRun, child: ChildProcess, cleanup: () => void): void {
    let stderr = "";
    let succeeded = false;
    let spawnFailed = false;

    if (child.stdout) {
      createInterface({ input: child.stdout }).on("line", (line) => {
        for (const event of parseStreamJsonLine(line)) {
          if (event.type === "session") run.sessionId = event.sessionId;
          if (event.type === "result") {
            succeeded = event.ok;
            run.sessionId = event.sessionId ?? run.sessionId;
          }
          emit(run, event);
        }
      });
    }
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-STDERR_TAIL);
    });

    child.once("error", (error: NodeJS.ErrnoException) => {
      spawnFailed = true;
      cleanup();
      emit(run, {
        type: "error",
        message:
          error.code === "ENOENT"
            ? `Claude Code was not found ("${options.claudeCommand}"). Install it, or set REPO_CONTROL_CLAUDE to its path.`
            : `Could not start Claude Code: ${error.message}`
      });
      finish(run, "failed");
    });

    child.once("close", (code) => {
      if (spawnFailed) return;
      cleanup();
      if (run.cancelled) return finish(run, "cancelled");
      if (succeeded) return finish(run, "completed");
      if (!run.events.some((event) => event.type === "result")) {
        emit(run, { type: "error", message: stderr.trim() || `Claude Code exited with code ${code ?? "unknown"}.` });
      }
      finish(run, "failed");
    });
  }

  function snapshot(run: AgentRun): AgentRunSnapshot {
    return { id: run.id, status: run.status, prompt: run.prompt, sessionId: run.sessionId, createdAt: run.createdAt, events: [...run.events] };
  }

  return {
    start,

    get(runId: string): AgentRunSnapshot | null {
      const run = runs.get(runId);
      return run ? snapshot(run) : null;
    },

    /**
     * Replays the events after `afterSeq`, then delivers new ones as they happen. Returns
     * null for an unknown run; the returned function unsubscribes. `onEnd` fires once the run
     * has finished and every event has been delivered.
     */
    subscribe(runId: string, afterSeq: number, listener: AgentRunListener, onEnd: () => void): (() => void) | null {
      const run = runs.get(runId);
      if (!run) return null;
      for (const event of run.events.slice(afterSeq + 1)) listener(event);
      if (run.status !== "running") {
        onEnd();
        return () => {};
      }
      const wrapped: AgentRunListener = (event) => {
        listener(event);
        if (event.type === "status" && event.status !== "running") onEnd();
      };
      run.listeners.add(wrapped);
      return () => run.listeners.delete(wrapped);
    },

    decide(runId: string, approvalId: string, decision: { behavior: "allow" } | { behavior: "deny"; message?: string }): boolean {
      const run = runs.get(runId);
      if (!run) return false;
      return resolveApproval(
        run,
        approvalId,
        decision.behavior === "allow"
          ? { behavior: "allow" }
          : { behavior: "deny", message: decision.message?.trim() ? `The user declined: ${decision.message.trim()}` : "The user declined this action." },
        "user"
      );
    },

    cancel(runId: string): boolean {
      const run = runs.get(runId);
      if (!run || run.status !== "running") return false;
      run.cancelled = true;
      if (run.child) killProcess(run.child, "SIGTERM");
      else finish(run, "cancelled");
      return true;
    },

    /** Stops every run, for server shutdown. */
    stopAll(): void {
      for (const run of runs.values()) {
        if (run.status === "running") {
          run.cancelled = true;
          if (run.child) killProcess(run.child, "SIGKILL");
          finish(run, "cancelled");
        }
      }
    }
  };
}
