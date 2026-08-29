import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "./server.js";

// Walks the DNS-rebinding chain end to end. A page served from any origin can point at
// 127.0.0.1 by re-resolving its own hostname; the browser then treats the calls as
// same-origin, so neither CORS nor the Origin allowlist runs. Only the Host header still
// names the attacker.
test("rejects rebound requests at every step of the escalation chain", async (t) => {
  const { app } = await createServer();
  t.after(async () => { await app.close(); });

  const reboundHost = "attacker.example:3747";

  // 1. Widening the workspace root to the whole filesystem.
  const rootResponse = await app.inject({
    method: "POST",
    url: "/api/root",
    headers: { host: reboundHost },
    payload: { root: "/" }
  });
  assert.equal(rootResponse.statusCode, 403);
  assert.equal(rootResponse.json().code, "FORBIDDEN_HOST");

  // 2. Enumerating the repositories under it.
  const projectsResponse = await app.inject({
    method: "GET",
    url: "/api/projects",
    headers: { host: reboundHost }
  });
  assert.equal(projectsResponse.statusCode, 403);

  // 3. Running an arbitrary command inside one of them.
  const terminalResponse = await app.inject({
    method: "POST",
    url: "/api/projects/aGVyZQ/terminal/run",
    headers: { host: reboundHost },
    payload: { command: "id" }
  });
  assert.equal(terminalResponse.statusCode, 403);

  // Health is unauthenticated but must not leak the workspace root either.
  const healthResponse = await app.inject({
    method: "GET",
    url: "/api/health",
    headers: { host: reboundHost }
  });
  assert.equal(healthResponse.statusCode, 403);
  assert.equal(healthResponse.json().root, undefined);
});

test("still serves loopback callers, including the Vite dev origin and IPv6", async (t) => {
  const { app } = await createServer();
  t.after(async () => { await app.close(); });

  for (const host of ["127.0.0.1:3747", "localhost:3747", "127.0.0.1:5173", "[::1]:3747"]) {
    const response = await app.inject({ method: "GET", url: "/api/health", headers: { host } });
    assert.equal(response.statusCode, 200, `expected ${host} to be served`);
    assert.equal(response.json().ok, true);
  }
});

// A request with no Host header at all cannot be simulated through Fastify's inject,
// which always substitutes a default. That branch is covered in lib/requestHost.test.ts.
