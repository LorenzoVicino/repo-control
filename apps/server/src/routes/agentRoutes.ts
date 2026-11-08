import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { AgentBusyError, type AgentRunner } from "../services/agent/runner.js";
import type { AgentEvent } from "../services/agent/events.js";

type AgentRoutesContext = {
  agentRunner: AgentRunner;
  /** Reports whether the Claude Code CLI can be started, for the dashboard's empty state. */
  agentStatus: () => Promise<{ available: boolean; command: string; model: string | null }>;
};

const runParamsSchema = z.object({ runId: z.string().uuid() });
const approvalParamsSchema = z.object({ runId: z.string().uuid(), approvalId: z.string().uuid() });
const startBodySchema = z.object({
  prompt: z.string().trim().min(1).max(8_000),
  // A Claude Code session ID from an earlier run, to continue that conversation.
  sessionId: z.string().uuid().optional()
});
const decisionBodySchema = z.discriminatedUnion("behavior", [
  z.object({ behavior: z.literal("allow") }),
  z.object({ behavior: z.literal("deny"), message: z.string().max(500).optional() })
]);
const eventsQuerySchema = z.object({ after: z.coerce.number().int().min(-1).default(-1) });

const SSE_HEARTBEAT_MS = 15_000;

// Invalid input is the client's mistake and gets a 400 with the first problem named, rather
// than surfacing as a server error.
function parseOrReply<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, value: unknown, reply: FastifyReply): T | null {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const issue = parsed.error.issues[0];
  void reply.code(400).send({ ok: false, code: "INVALID_INPUT", message: `${issue?.path.join(".") || "input"}: ${issue?.message ?? "invalid"}` });
  return null;
}

export async function registerAgentRoutes(app: FastifyInstance, context: AgentRoutesContext): Promise<void> {
  app.addHook("onClose", async () => context.agentRunner.stopAll());

  app.get("/api/agent", async () => context.agentStatus());

  app.post("/api/agent/runs", async (request, reply) => {
    const body = parseOrReply(startBodySchema, request.body ?? {}, reply);
    if (!body) return reply;
    try {
      const run = await context.agentRunner.start({ prompt: body.prompt, resumeSessionId: body.sessionId });
      return reply.code(202).send(run);
    } catch (error) {
      if (error instanceof AgentBusyError) return reply.code(409).send({ ok: false, code: "AGENT_BUSY", message: error.message });
      throw error;
    }
  });

  app.get("/api/agent/runs/:runId", async (request, reply) => {
    const params = parseOrReply(runParamsSchema, request.params, reply);
    if (!params) return reply;
    const run = context.agentRunner.get(params.runId);
    return run ?? reply.code(404).send({ ok: false, code: "RUN_NOT_FOUND", message: "That agent run does not exist." });
  });

  // Server-sent events: replays everything after `after` (or the Last-Event-ID header a
  // reconnecting EventSource sends), then streams new events until the run ends.
  app.get("/api/agent/runs/:runId/events", async (request, reply) => {
    const params = parseOrReply(runParamsSchema, request.params, reply);
    if (!params) return reply;
    const { runId } = params;
    const lastEventId = Number(request.headers["last-event-id"]);
    const query = parseOrReply(eventsQuerySchema, request.query, reply);
    if (!query) return reply;
    const after = Number.isInteger(lastEventId) && lastEventId >= -1 ? lastEventId : query.after;

    if (!context.agentRunner.get(runId)) {
      return reply.code(404).send({ ok: false, code: "RUN_NOT_FOUND", message: "That agent run does not exist." });
    }

    reply.hijack();
    const response = reply.raw;
    response.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    });

    let open = true;
    // Assigned after subscribing; a finished run ends the stream during that very call.
    let unsubscribe: (() => void) | null = null;
    const heartbeat = setInterval(() => open && response.write(": keep-alive\n\n"), SSE_HEARTBEAT_MS);
    const send = (event: AgentEvent) => {
      if (open) response.write(`id: ${event.seq}\nevent: agent\ndata: ${JSON.stringify(event)}\n\n`);
    };
    const close = () => {
      if (!open) return;
      open = false;
      clearInterval(heartbeat);
      unsubscribe?.();
      response.end();
    };
    unsubscribe = context.agentRunner.subscribe(runId, after, send, () => {
      if (open) response.write("event: end\ndata: {}\n\n");
      close();
    });
    request.raw.on("close", close);
  });

  app.post("/api/agent/runs/:runId/approvals/:approvalId", async (request, reply) => {
    const params = parseOrReply(approvalParamsSchema, request.params, reply);
    const decision = params && parseOrReply(decisionBodySchema, request.body ?? {}, reply);
    if (!params || !decision) return reply;
    if (!context.agentRunner.decide(params.runId, params.approvalId, decision)) {
      return reply.code(409).send({ ok: false, code: "APPROVAL_NOT_PENDING", message: "That approval has already been answered or has expired." });
    }
    return { ok: true };
  });

  app.post("/api/agent/runs/:runId/cancel", async (request, reply) => {
    const params = parseOrReply(runParamsSchema, request.params, reply);
    if (!params) return reply;
    if (!context.agentRunner.cancel(params.runId)) {
      return reply.code(409).send({ ok: false, code: "RUN_NOT_ACTIVE", message: "That agent run is not in progress." });
    }
    return { ok: true };
  });
}
