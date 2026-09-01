import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";
import { readEnv } from "../config/env.js";
import { SESSION_COOKIE_NAME } from "../lib/sessionCookie.js";
import { createServer } from "../server.js";

const USERNAME = "owner";
const PASSWORD = "local-dev-password";

type TestServer = Awaited<ReturnType<typeof createServer>>["app"];

// Every server in this file gets its own workspace and configuration directory, and its own
// in-memory guard, so the sign-in lockout in one test cannot reach another.
async function startTestServer(
  context: TestContext,
  credentials: { username?: string; password?: string }
): Promise<TestServer> {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-auth-test-"));
  const previousEnv = { ...process.env };

  process.env.REPO_CONTROL_ROOT = temporaryRoot;
  process.env.REPO_CONTROL_CONFIG_DIR = path.join(temporaryRoot, "config");
  delete process.env.REPO_CONTROL_AUTH_USERNAME;
  delete process.env.REPO_CONTROL_AUTH_PASSWORD;

  if (credentials.username !== undefined) process.env.REPO_CONTROL_AUTH_USERNAME = credentials.username;
  if (credentials.password !== undefined) process.env.REPO_CONTROL_AUTH_PASSWORD = credentials.password;

  const { app } = await createServer();

  context.after(async () => {
    await app.close();
    process.env = previousEnv;
    await fs.rm(temporaryRoot, { force: true, recursive: true });
  });

  return app;
}

function readSetCookie(response: { headers: Record<string, unknown> }): string {
  const header = response.headers["set-cookie"];
  const cookie = Array.isArray(header) ? header[0] : header;
  assert.equal(typeof cookie, "string", "expected a Set-Cookie header");

  return String(cookie);
}

async function signIn(app: TestServer, remember = false): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: USERNAME, password: PASSWORD, remember }
  });

  assert.equal(response.statusCode, 200);

  return readSetCookie(response).split(";")[0];
}

test("refuses to start with half a credential pair", () => {
  assert.throws(
    () => readEnv({ REPO_CONTROL_AUTH_USERNAME: USERNAME }),
    /REPO_CONTROL_AUTH_USERNAME and REPO_CONTROL_AUTH_PASSWORD together/
  );
  assert.throws(
    () => readEnv({ REPO_CONTROL_AUTH_PASSWORD: PASSWORD }),
    /REPO_CONTROL_AUTH_USERNAME and REPO_CONTROL_AUTH_PASSWORD together/
  );

  // A blank value is a disabled credential, not half a pair.
  const env = readEnv({ REPO_CONTROL_AUTH_USERNAME: "  ", REPO_CONTROL_AUTH_PASSWORD: "" });
  assert.equal(env.REPO_CONTROL_AUTH_USERNAME, undefined);
  assert.equal(env.REPO_CONTROL_AUTH_PASSWORD, undefined);
});

test("leaves the API open when no credentials are configured", async (context) => {
  const app = await startTestServer(context, {});

  const session = await app.inject({ method: "GET", url: "/api/auth/session" });
  assert.deepEqual(session.json(), { authRequired: false, authenticated: true, username: null });

  const projects = await app.inject({ method: "GET", url: "/api/projects" });
  assert.equal(projects.statusCode, 200);

  const health = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(typeof health.json().root, "string");

  // There is nothing to sign in to, and saying so is clearer than a wrong-password answer.
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: USERNAME, password: PASSWORD }
  });
  assert.equal(login.statusCode, 409);
  assert.equal(login.json().code, "AUTH_DISABLED");
});

test("closes every workspace endpoint until the caller signs in", async (context) => {
  const app = await startTestServer(context, { username: USERNAME, password: PASSWORD });

  const session = await app.inject({ method: "GET", url: "/api/auth/session" });
  assert.deepEqual(session.json(), { authRequired: true, authenticated: false, username: null });

  for (const request of [
    { method: "GET" as const, url: "/api/projects" },
    { method: "GET" as const, url: "/api/preferences" },
    { method: "POST" as const, url: "/api/root", payload: { root: "/" } },
    { method: "POST" as const, url: "/api/projects/aGVyZQ/terminal/run", payload: { command: "id" } },
    { method: "GET" as const, url: "/api/workflows" },
    { method: "GET" as const, url: "/api/agent-sessions" }
  ]) {
    const response = await app.inject(request);
    assert.equal(response.statusCode, 401, `expected ${request.method} ${request.url} to be closed`);
    assert.equal(response.json().code, "UNAUTHENTICATED");
  }

  // Health answers so a supervisor can probe the API, but without naming the workspace.
  const health = await app.inject({ method: "GET", url: "/api/health" });
  assert.equal(health.statusCode, 200);
  assert.deepEqual(health.json(), { ok: true, authRequired: true });
});

test("opens the workspace for the session the sign-in hands out", async (context) => {
  const app = await startTestServer(context, { username: USERNAME, password: PASSWORD });

  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: USERNAME, password: PASSWORD }
  });
  assert.equal(login.statusCode, 200);
  assert.deepEqual(login.json(), {
    ok: true,
    authRequired: true,
    authenticated: true,
    username: USERNAME
  });

  const setCookie = readSetCookie(login);
  assert.match(setCookie, new RegExp(`^${SESSION_COOKIE_NAME}=[\\w-]+;`));
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Max-Age=43200/);

  const cookie = setCookie.split(";")[0];

  const projects = await app.inject({ method: "GET", url: "/api/projects", headers: { cookie } });
  assert.equal(projects.statusCode, 200);

  const health = await app.inject({ method: "GET", url: "/api/health", headers: { cookie } });
  assert.equal(typeof health.json().root, "string");

  const session = await app.inject({ method: "GET", url: "/api/auth/session", headers: { cookie } });
  assert.deepEqual(session.json(), { authRequired: true, authenticated: true, username: USERNAME });
});

test("keeps a remembered session alive for a month", async (context) => {
  const app = await startTestServer(context, { username: USERNAME, password: PASSWORD });

  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: USERNAME, password: PASSWORD, remember: true }
  });

  assert.match(readSetCookie(login), /Max-Age=2592000/);
});

test("ends the session on sign-out", async (context) => {
  const app = await startTestServer(context, { username: USERNAME, password: PASSWORD });
  const cookie = await signIn(app);

  const logout = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
  assert.equal(logout.statusCode, 200);
  assert.match(readSetCookie(logout), /Max-Age=0/);
  assert.deepEqual(logout.json(), {
    ok: true,
    authRequired: true,
    authenticated: false,
    username: null
  });

  // The token is revoked server-side, so replaying the cookie is not enough to get back in.
  const projects = await app.inject({ method: "GET", url: "/api/projects", headers: { cookie } });
  assert.equal(projects.statusCode, 401);
});

test("answers a wrong password, a malformed body and a guessing loop differently", async (context) => {
  const app = await startTestServer(context, { username: USERNAME, password: PASSWORD });

  const malformed = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: USERNAME } });
  assert.equal(malformed.statusCode, 400);
  assert.equal(malformed.json().code, "INVALID_REQUEST");

  const wrong = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: USERNAME, password: "wrong" }
  });
  assert.equal(wrong.statusCode, 401);
  assert.equal(wrong.json().code, "INVALID_CREDENTIALS");
  // The answer must not reveal which half of the pair was wrong.
  assert.equal(wrong.json().message, "Incorrect username or password.");
  assert.equal(wrong.headers["set-cookie"], undefined);

  let lockedResponse = wrong;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    lockedResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: USERNAME, password: "wrong" }
    });
  }

  assert.equal(lockedResponse.statusCode, 429);
  assert.equal(lockedResponse.json().code, "TOO_MANY_ATTEMPTS");
  assert.equal(lockedResponse.json().retryAfterSeconds > 0, true);
  assert.equal(lockedResponse.headers["retry-after"], String(lockedResponse.json().retryAfterSeconds));
});

test("still rejects a rebound request that carries a valid session", async (context) => {
  const app = await startTestServer(context, { username: USERNAME, password: PASSWORD });
  const cookie = await signIn(app);

  const response = await app.inject({
    method: "GET",
    url: "/api/projects",
    headers: { cookie, host: "attacker.example:3747" }
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().code, "FORBIDDEN_HOST");
});
