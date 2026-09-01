import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import Fastify from "fastify";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { CommandResult } from "../lib/commandRunner.js";
import { createContainerSessionStore } from "../services/containerSessionService.js";
import { registerDockerRoutes } from "./dockerRoutes.js";

const RUNNING_CONTAINER_ID = "a1b2c3d4e5f6";
const ECHO_SHELL = "process.stdin.on('data', (chunk) => process.stdout.write('out:' + chunk));";

function commandResult(overrides: Partial<CommandResult> = {}): CommandResult {
  return {
    ok: true,
    command: "docker",
    exitCode: 0,
    stdout: "",
    stderr: "",
    output: "",
    durationMs: 1,
    ...overrides
  };
}

// One running container, a shell probe that finds bash, and one stats sample - enough for
// the routes without a Docker daemon anywhere near the test.
function createFakeDaemon() {
  const calls: string[][] = [];

  const runProjectCommand = async (
    _cwd: string,
    command: string,
    args: string[]
  ): Promise<CommandResult> => {
    calls.push([command, ...args]);

    if (args[0] === "ps") {
      return commandResult({
        stdout: [
          RUNNING_CONTAINER_ID,
          "acme-web-1",
          "app:web",
          "Up 2 hours",
          "0.0.0.0:3000->3000/tcp",
          "2 hours",
          "com.docker.compose.project=acme,com.docker.compose.service=web"
        ].join("\t")
      });
    }

    if (args[0] === "exec") {
      return commandResult({ stdout: "bash\n" });
    }

    if (args[0] === "stats") {
      return commandResult({
        stdout: JSON.stringify({
          ID: RUNNING_CONTAINER_ID,
          Name: "acme-web-1",
          CPUPerc: "12.50%",
          MemUsage: "128MiB / 1.9GiB",
          MemPerc: "6.58%",
          NetIO: "1.2kB / 640B",
          BlockIO: "8.19MB / 0B",
          PIDs: "17"
        })
      });
    }

    return commandResult();
  };

  return { calls, runProjectCommand };
}

async function createTestApp(context: { spawnProcess?: (command: string, args: string[]) => ChildProcess } = {}) {
  const daemon = createFakeDaemon();
  const app = Fastify();
  const containerSessions = createContainerSessionStore({
    spawnProcess:
      context.spawnProcess ??
      (() => spawn(process.execPath, ["-e", ECHO_SHELL], { stdio: ["pipe", "pipe", "pipe"] })),
    maxSessions: 2
  });

  await registerDockerRoutes(app, {
    getActiveRootPath: () => "/workspace",
    setActiveRootPath: () => {},
    resolveProjectPath: async () => "/workspace/acme",
    runProjectCommand: daemon.runProjectCommand,
    containerSessions
  });

  return { app, daemon, containerSessions };
}

test("opens an exec session only for a container the daemon reports as running", async (t) => {
  const { app, daemon } = await createTestApp();
  t.after(async () => { await app.close(); });

  const unknown = await app.inject({
    method: "POST",
    url: "/api/docker/containers/ffffffffffff/exec",
    payload: {}
  });
  assert.equal(unknown.statusCode, 404);
  assert.equal(unknown.json().code, "CONTAINER_NOT_RUNNING");

  const opened = await app.inject({
    method: "POST",
    url: `/api/docker/containers/${RUNNING_CONTAINER_ID}/exec`,
    payload: {}
  });
  assert.equal(opened.statusCode, 200);
  const session = opened.json();
  assert.equal(session.kind, "exec");
  assert.equal(session.shell, "bash");
  assert.equal(session.containerName, "acme-web-1");
  assert.equal(session.running, true);

  // The container ID reaches docker as an argument, never a shell string.
  const execCall = daemon.calls.find((call) => call[1] === "exec");
  assert.deepEqual(execCall?.slice(0, 3), ["docker", "exec", RUNNING_CONTAINER_ID]);
});

test("runs a command in the session and streams back only new output", async (t) => {
  const { app } = await createTestApp();
  t.after(async () => { await app.close(); });

  const opened = await app.inject({
    method: "POST",
    url: `/api/docker/containers/${RUNNING_CONTAINER_ID}/exec`,
    payload: { shell: "sh" }
  });
  const sessionId = opened.json().id;
  assert.equal(opened.json().shell, "sh");

  const written = await app.inject({
    method: "POST",
    url: `/api/docker/sessions/${sessionId}/input`,
    payload: { data: "ls\n" }
  });
  assert.equal(written.statusCode, 200);

  let cursor = 0;
  let chunk = "";
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline && !chunk) {
    const read = await app.inject({ method: "GET", url: `/api/docker/sessions/${sessionId}?cursor=${cursor}` });
    assert.equal(read.statusCode, 200);
    chunk = read.json().chunk;
    cursor = read.json().cursor;

    if (!chunk) await delay(20);
  }

  assert.equal(chunk, "out:ls\n");

  const idle = await app.inject({ method: "GET", url: `/api/docker/sessions/${sessionId}?cursor=${cursor}` });
  assert.equal(idle.json().chunk, "");
  assert.equal(idle.json().truncated, false);

  const closed = await app.inject({ method: "DELETE", url: `/api/docker/sessions/${sessionId}` });
  assert.equal(closed.statusCode, 200);

  const afterClose = await app.inject({ method: "GET", url: `/api/docker/sessions/${sessionId}` });
  assert.equal(afterClose.statusCode, 404);
  assert.equal(afterClose.json().code, "SESSION_NOT_FOUND");

  const deleteAgain = await app.inject({ method: "DELETE", url: `/api/docker/sessions/${sessionId}` });
  assert.equal(deleteAgain.statusCode, 404);
});

test("follows container logs without accepting input", async (t) => {
  const { app, containerSessions } = await createTestApp();
  t.after(async () => { await app.close(); });

  const opened = await app.inject({
    method: "POST",
    url: `/api/docker/containers/${RUNNING_CONTAINER_ID}/logs`,
    payload: { tail: 50 }
  });
  assert.equal(opened.statusCode, 200);
  const session = opened.json();
  assert.equal(session.kind, "logs");
  assert.equal(session.shell, null);
  assert.equal(session.command, `docker logs --follow --tail 50 ${RUNNING_CONTAINER_ID}`);

  const rejected = await app.inject({
    method: "POST",
    url: `/api/docker/sessions/${session.id}/input`,
    payload: { data: "whoami\n" }
  });
  assert.equal(rejected.statusCode, 409);
  assert.equal(rejected.json().code, "SESSION_NOT_WRITABLE");

  containerSessions.close(session.id);
});

test("refuses a session when the container has no shell", async (t) => {
  const app = Fastify();
  t.after(async () => { await app.close(); });

  await registerDockerRoutes(app, {
    getActiveRootPath: () => "/workspace",
    setActiveRootPath: () => {},
    resolveProjectPath: async () => "/workspace/acme",
    runProjectCommand: async (_cwd, _command, args) => {
      if (args[0] === "ps") {
        return commandResult({
          stdout: `${RUNNING_CONTAINER_ID}\tdistroless-app\tapp:distroless\tUp\t\tnow\t`
        });
      }

      // The probe itself fails: there is no `sh` to run it with.
      return commandResult({ ok: false, exitCode: 126, stderr: "executable file not found in $PATH" });
    },
    containerSessions: createContainerSessionStore({ spawnProcess: () => spawn(process.execPath, ["-e", ""]) })
  });

  const response = await app.inject({
    method: "POST",
    url: `/api/docker/containers/${RUNNING_CONTAINER_ID}/exec`,
    payload: {}
  });

  assert.equal(response.statusCode, 422);
  assert.equal(response.json().code, "NO_CONTAINER_SHELL");
});

test("answers 429 once too many sessions are open", async (t) => {
  const { app } = await createTestApp();
  t.after(async () => { await app.close(); });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const opened = await app.inject({
      method: "POST",
      url: `/api/docker/containers/${RUNNING_CONTAINER_ID}/exec`,
      payload: {}
    });
    assert.equal(opened.statusCode, 200);
  }

  const refused = await app.inject({
    method: "POST",
    url: `/api/docker/containers/${RUNNING_CONTAINER_ID}/exec`,
    payload: {}
  });
  assert.equal(refused.statusCode, 429);
  assert.equal(refused.json().code, "SESSION_LIMIT");
});

test("reports one stats sample per container", async (t) => {
  const { app, daemon } = await createTestApp();
  t.after(async () => { await app.close(); });

  const response = await app.inject({ method: "GET", url: "/api/docker/stats" });
  assert.equal(response.statusCode, 200);
  const body = response.json();

  assert.equal(body.ok, true);
  assert.equal(body.stats.length, 1);
  assert.deepEqual(body.stats[0], {
    id: RUNNING_CONTAINER_ID,
    name: "acme-web-1",
    cpuPercent: 12.5,
    memoryUsedBytes: 134217728,
    memoryLimitBytes: 2040109466,
    memoryPercent: 6.58,
    networkInBytes: 1200,
    networkOutBytes: 640,
    blockReadBytes: 8190000,
    blockWriteBytes: 0,
    processCount: 17
  });

  // --no-stream, or the request would never return.
  const statsCall = daemon.calls.find((call) => call[1] === "stats");
  assert.equal(statsCall?.includes("--no-stream"), true);
});

test("closes every open session when the server shuts down", async () => {
  const { app, containerSessions } = await createTestApp();

  await app.inject({
    method: "POST",
    url: `/api/docker/containers/${RUNNING_CONTAINER_ID}/exec`,
    payload: {}
  });
  assert.equal(containerSessions.count(), 1);

  await app.close();
  assert.equal(containerSessions.count(), 0);
});
