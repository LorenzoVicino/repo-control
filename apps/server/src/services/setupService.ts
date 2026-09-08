import { getVSCodeLauncherCandidates } from "../runtime.js";
import { isExecutableAvailable } from "./agentSessionService.js";
import type { CommandRunner } from "../lib/commandRunner.js";

export async function detectSetupTools(run: CommandRunner) {
  const editors = await getVSCodeLauncherCandidates();
  const specs = [
    { id: "git", label: "Git", required: true, commands: ["git"] },
    { id: "docker", label: "Docker", required: false, commands: ["docker"] },
    {
      id: "vscode",
      label: "VS Code",
      required: false,
      commands: editors.map((item) => item.command),
    },
    {
      id: "codex",
      label: "Codex",
      required: false,
      commands: [process.env.REPO_CONTROL_CODEX || "codex"],
    },
    {
      id: "claude",
      label: "Claude Code",
      required: false,
      commands: [process.env.REPO_CONTROL_CLAUDE || "claude"],
    },
    {
      id: "gemini",
      label: "Gemini CLI",
      required: false,
      commands: [process.env.REPO_CONTROL_GEMINI || "gemini"],
    },
  ];
  return Promise.all(
    specs.map(async ({ commands, ...tool }) => {
      const installed = (
        await Promise.all(
          commands.map((command) =>
            isExecutableAvailable(command, process.env),
          ),
        )
      ).some(Boolean);
      let status: "available" | "missing" | "unreachable" = installed
        ? "available"
        : "missing";
      if (installed && tool.id === "docker") {
        const result = await run(
          process.cwd(),
          "docker",
          ["info", "--format", "{{.ServerVersion}}"],
          4000,
        );
        if (!result.ok) status = "unreachable";
      }
      return { ...tool, status };
    }),
  );
}
