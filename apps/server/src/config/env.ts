import { z } from "zod";

const envSchema = z.object({
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
    .transform((value) => value === "1" || value?.toLowerCase() === "true")
});

export type ServerEnv = z.infer<typeof envSchema>;

export function readEnv(input: NodeJS.ProcessEnv = process.env): ServerEnv {
  return envSchema.parse(input);
}
