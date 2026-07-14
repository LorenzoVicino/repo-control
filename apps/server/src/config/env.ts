import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().default("127.0.0.1"),
  PORT: z.coerce.number().default(3747),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("error"),
  REPO_CONTROL_ROOT: z.string().default(process.cwd()),
  API_NINJAS_API_KEY: z
    .string()
    .trim()
    .default("")
    .transform((value) => value || undefined)
});

export type ServerEnv = z.infer<typeof envSchema>;

export function readEnv(input: NodeJS.ProcessEnv = process.env): ServerEnv {
  return envSchema.parse(input);
}
