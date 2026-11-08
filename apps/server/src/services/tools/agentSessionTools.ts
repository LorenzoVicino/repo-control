import { z } from "zod";
import { count, relativePath } from "./format.js";
import { defineTool } from "./types.js";

export const listAgentSessions = defineTool({
  name: "list_agent_sessions",
  title: "Find coding-agent sessions",
  description:
    "List past Claude Code, Codex and Gemini CLI sessions that ran inside workspace repositories, newest first. " +
    "Search their titles and transcripts to find where a topic was worked on, and filter to one repository.",
  effect: "read",
  inputShape: {
    repository: z.string().min(1).max(500).optional().describe("Only sessions in this repository (name, relative path or id)."),
    search: z.string().trim().max(200).optional().describe("Words to look for in session titles and transcripts."),
    limit: z.number().int().min(1).max(50).default(15).describe("How many sessions to return.")
  },
  async run(runtime, input) {
    const rootPath = runtime.rootPath();
    const projects = await runtime.listRepositories();
    const scope = input.repository ? (await runtime.resolveRepository(input.repository)).project : null;
    const scan = await runtime.scanAgentSessions(rootPath, projects, { searchTerm: input.search ?? "" });
    const matching = scope ? scan.sessions.filter((session) => session.projectId === scope.id) : scan.sessions;
    const sessions = matching.slice(0, input.limit);

    const lines = sessions.map((session) => {
      const when = session.updatedAt ?? session.startedAt;
      return (
        `- ${session.providerLabel} in ${session.projectName}${session.branch ? ` on ${session.branch}` : ""}` +
        `${when ? `, ${when.slice(0, 16).replace("T", " ")}` : ""}: ${session.title}` +
        `${session.match?.field === "content" ? `\n  "${session.match.snippet}"` : ""}`
      );
    });
    const filters = [scope ? `in ${scope.name}` : "", input.search ? `matching "${input.search}"` : ""].filter(Boolean).join(" ");
    const heading = `${count(matching.length, "session")}${filters ? ` ${filters}` : ""}${matching.length > sessions.length ? `, showing ${sessions.length}` : ""}.`;

    return {
      text: [heading, ...lines, ...scan.warnings.map((warning) => `Warning: ${warning}`)].join("\n"),
      data: {
        total: matching.length,
        agents: scan.agents.map(({ id, label, installed, sessionCount }) => ({ id, label, installed, sessionCount })),
        sessions: sessions.map(({ projectPath, ...session }) => ({ ...session, relativePath: relativePath(rootPath, projectPath) }))
      }
    };
  }
});

export const agentSessionTools = [listAgentSessions];
