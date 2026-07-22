import { runClaudeMessage } from "./claudeService.js";

export type AgentProviderId = "claude";
export type AgentRunMode = "plan" | "implement";

export type AgentRunInput = {
  cwd: string;
  prompt: string;
  mode: AgentRunMode;
  sessionId?: string | null;
  additionalDirectories?: string[];
  signal?: AbortSignal;
};

export type AgentRunResult = {
  ok: boolean;
  sessionId: string | null;
  response: string;
  error: string | null;
};

export type AgentProvider = {
  id: AgentProviderId;
  label: string;
  run(input: AgentRunInput): Promise<AgentRunResult>;
};

const claudeProvider: AgentProvider = {
  id: "claude",
  label: "Claude Code",
  async run(input) {
    return runClaudeMessage(
      input.cwd,
      input.prompt,
      input.sessionId,
      input.mode === "plan" ? "plan" : "acceptEdits",
      input.additionalDirectories,
      input.signal
    );
  }
};

export function getAgentProvider(providerId: AgentProviderId = "claude"): AgentProvider {
  if (providerId === "claude") return claudeProvider;
  return claudeProvider;
}
