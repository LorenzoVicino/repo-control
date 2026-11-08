import { z } from "zod";

const envSchema = z
  .object({
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().default(3747),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("error"),
    REPO_CONTROL_ROOT: z.string().default(process.cwd()),
    // Comma-separated extra hostnames accepted in the Host header, on top of the loopback
    // names and HOST. Only needed when reaching the API through another name.
    ALLOWED_HOSTS: z.string().optional(),
    // Serve the built dashboard from the API process instead of the Vite dev server. Set by
    // the repo-control binary and by npm start; left off during npm run dev, where Vite owns
    // the UI. Opt-in rather than auto-detected so a stale apps/web/dist in a checkout cannot
    // quietly change how the dev server reports itself.
    REPO_CONTROL_SERVE_WEB: z
      .string()
      .optional()
      .transform((value) => value === "1" || value?.toLowerCase() === "true"),
    // Single set of local credentials. Sign-in is enforced only when both are present, so an
    // existing install keeps opening straight into the dashboard. An empty value counts as
    // unset, which keeps a commented-out or blank line in .env from failing the boot.
    REPO_CONTROL_AUTH_USERNAME: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? value : undefined)),
    REPO_CONTROL_AUTH_PASSWORD: z
      .string()
      .optional()
      .transform((value) => (value ? value : undefined)),
    // Bearer token that turns on the HTTP MCP endpoint (/mcp) for external clients. Unset
    // or empty leaves the endpoint off. Long enough that guessing it is not an option.
    REPO_CONTROL_MCP_TOKEN: z
      .string()
      .optional()
      .transform((value) => (value?.trim() ? value.trim() : undefined))
      .refine((value) => value === undefined || value.length >= 32, "REPO_CONTROL_MCP_TOKEN must be at least 32 characters"),
    // Expose write tools (commit, push, pull, Compose, workflow runs) to external MCP
    // clients. Off by default: an external client then sees read-only tools only.
    // Model for the in-app agent, passed to `claude --model` (an alias such as "sonnet" or a
    // full model name). Unset uses Claude Code's own default.
    REPO_CONTROL_AGENT_MODEL: z
      .string()
      .trim()
      .regex(/^[\w.:[\]-]*$/, "REPO_CONTROL_AGENT_MODEL must be a model name or alias")
      .optional()
      .transform((value) => (value ? value : undefined)),
    REPO_CONTROL_MCP_WRITE: z
      .string()
      .optional()
      .transform((value) => ["1", "true", "on"].includes(value?.trim().toLowerCase() ?? ""))
  })
  .superRefine((value, context) => {
    const hasUsername = Boolean(value.REPO_CONTROL_AUTH_USERNAME);
    const hasPassword = Boolean(value.REPO_CONTROL_AUTH_PASSWORD);

    // Half a credential pair cannot be honoured either way: enforcing it would lock the
    // owner out, ignoring it would leave an API they believe is protected wide open. Refuse
    // to start instead of silently picking one.
    if (hasUsername !== hasPassword) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [hasUsername ? "REPO_CONTROL_AUTH_PASSWORD" : "REPO_CONTROL_AUTH_USERNAME"],
        message:
          "Set REPO_CONTROL_AUTH_USERNAME and REPO_CONTROL_AUTH_PASSWORD together to require sign-in, or leave both unset."
      });
    }
  });

export type ServerEnv = z.infer<typeof envSchema>;

export function readEnv(input: NodeJS.ProcessEnv = process.env): ServerEnv {
  return envSchema.parse(input);
}
