export type AgentSessionProvider = "claude" | "codex" | "gemini";

export type AgentInstallation = {
  id: AgentSessionProvider;
  label: string;
  installed: boolean;
  used: boolean;
  command: string;
  sessionCount: number;
};

export type AgentSessionSummary = {
  id: string;
  provider: AgentSessionProvider;
  providerLabel: string;
  projectId: string;
  projectName: string;
  projectPath: string;
  title: string;
  preview: string | null;
  branch: string | null;
  startedAt: string | null;
  updatedAt: string | null;
  match: AgentSessionSearchMatch | null;
};

export type AgentSessionSearchMatch = {
  field: "title" | "content";
  snippet: string;
};

export type AgentSessionsResponse = {
  root: string;
  agents: AgentInstallation[];
  sessions: AgentSessionSummary[];
  scannedAt: string;
  warnings: string[];
};

export type AgentSessionResumeResponse = {
  ok: boolean;
  message: string;
  command: string;
};
