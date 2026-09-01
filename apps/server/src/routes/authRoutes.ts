import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { serializeClearedSessionCookie, serializeSessionCookie } from "../lib/sessionCookie.js";
import type { AuthGuard } from "../services/authService.js";

type AuthRoutesContext = {
  auth: AuthGuard;
};

const credentialsSchema = z.object({
  username: z.string().min(1).max(256),
  password: z.string().min(1).max(1024),
  remember: z.boolean().optional()
});

export async function registerAuthRoutes(app: FastifyInstance, context: AuthRoutesContext): Promise<void> {
  // Reachable without a session: the dashboard asks this first to learn whether it has to
  // show the sign-in screen at all.
  app.get("/api/auth/session", async (request) => context.auth.readSessionState(request.headers.cookie));

  app.post("/api/auth/login", async (request, reply) => {
    const credentials = credentialsSchema.safeParse(request.body);

    if (!credentials.success) {
      return reply.code(400).send({
        ok: false,
        code: "INVALID_REQUEST",
        message: "Provide a username and a password."
      });
    }

    const result = context.auth.login(credentials.data);

    if (result.ok) {
      return reply
        .header("set-cookie", serializeSessionCookie(result.token, result.ttlMs / 1000))
        .send({
          ok: true,
          authRequired: true,
          authenticated: true,
          username: context.auth.username
        });
    }

    if (result.reason === "disabled") {
      return reply.code(409).send({
        ok: false,
        code: "AUTH_DISABLED",
        message: "This server has no credentials configured, so there is nothing to sign in to."
      });
    }

    if (result.reason === "locked") {
      const retryAfterSeconds = Math.max(1, Math.ceil(result.retryAfterMs / 1000));

      return reply
        .code(429)
        .header("retry-after", String(retryAfterSeconds))
        .send({
          ok: false,
          code: "TOO_MANY_ATTEMPTS",
          message: `Too many failed attempts. Try again in ${retryAfterSeconds} seconds.`,
          retryAfterSeconds
        });
    }

    // The submitted username is deliberately absent from the log line: it is half of the
    // credential pair, and the log is a local file the owner may share when reporting a bug.
    request.log.warn({ ip: request.ip }, "Rejected sign-in attempt");

    return reply.code(401).send({
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Incorrect username or password."
    });
  });

  app.post("/api/auth/logout", async (request, reply) => {
    context.auth.revokeRequestSession(request.headers.cookie);

    return reply.header("set-cookie", serializeClearedSessionCookie()).send({
      ok: true,
      authRequired: context.auth.enabled,
      authenticated: false,
      username: null
    });
  });
}
