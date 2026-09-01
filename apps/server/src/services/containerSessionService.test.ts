import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import {
  ContainerSessionLimitError,
  createContainerSessionStore,
  type ContainerSessionStore,
  type OpenContainerSessionInput
} from "./containerSessionService.js";

// Stands in for `docker exec -i <id> bash`: a real process with real pipes that answers
// stdin, so the store is exercised against process behaviour rather than a mock.
const ECHO_SHELL = "process.stdin.on('data', (chunk) => process.stdout.write('out:' + chunk));";

function spawnScript(script: string): (command: string, args: string[]) => ChildProcess {
  return () => spawn(process.execPath, ["-e", script], { stdio: ["pipe", "pipe", "pipe"] });
}

function execInput(overrides: Partial<OpenContainerSessionInput> = {}): OpenContainerSessionInput {
  return {
    kind: "exec",
    containerId: "abc123abc123",
    containerName: "acme-web-1",
    dockerArgs: ["exec", "-i", "abc123abc123", "bash"],
    shell: "bash",
    acceptsInput: true,
    ...overrides
  };
}

async function waitForChunk(
  store: ContainerSessionStore,
  sessionId: string,
  cursor: number
): Promise<{ chunk: string; cursor: number }> {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    const read = store.read(sessionId, cursor);
    assert.notEqual(read, null);

    if (read && read.chunk) {
      return { chunk: read.chunk, cursor: read.cursor };
    }

    await delay(10);
  }

  throw new Error("The session produced no output in time");
}

test("keeps one shell alive and hands every reader only what it has not seen", async (t) => {
  const store = createContainerSessionStore({ spawnProcess: spawnScript(ECHO_SHELL) });
  t.after(() => store.closeAll());

  const session = store.open(execInput());
  assert.match(session.id, /^[\w-]{16,}$/);
  assert.equal(session.kind, "exec");
  assert.equal(session.shell, "bash");
  assert.equal(session.running, true);
  assert.equal(session.cursor, 0);
  assert.equal(session.command, "docker exec -i abc123abc123 bash");

  assert.equal(store.write(session.id, "ls\n"), true);
  const first = await waitForChunk(store, session.id, 0);
  assert.equal(first.chunk, "out:ls\n");

  // Reading again from the returned cursor yields nothing new, not the same output twice.
  const repeated = store.read(session.id, first.cursor);
  assert.equal(repeated?.chunk, "");
  assert.equal(repeated?.truncated, false);

  assert.equal(store.write(session.id, "pwd\n"), true);
  const second = await waitForChunk(store, session.id, first.cursor);
  assert.equal(second.chunk, "out:pwd\n");

  // A late reader starting from zero still gets the whole retained transcript.
  const fromStart = store.read(session.id, 0);
  assert.equal(fromStart?.chunk, "out:ls\nout:pwd\n");
});

test("says so when output has scrolled out of the retained window", async (t) => {
  const store = createContainerSessionStore({
    spawnProcess: spawnScript(ECHO_SHELL),
    bufferLimit: 12
  });
  t.after(() => store.closeAll());

  const session = store.open(execInput());
  store.write(session.id, "aaaaaaaaaa\n");
  await waitForChunk(store, session.id, 0);
  store.write(session.id, "bbbbbbbbbb\n");
  await delay(150);

  const read = store.read(session.id, 0);
  assert.equal(read?.truncated, true);
  assert.equal(read?.chunk.length, 12);
  assert.equal(read?.cursor, "out:aaaaaaaaaa\nout:bbbbbbbbbb\n".length);
  // Reading from the current cursor is never reported as truncated.
  assert.equal(store.read(session.id, read?.cursor ?? 0)?.truncated, false);
});

test("refuses input for a log stream, an unknown session and a closed one", async (t) => {
  const store = createContainerSessionStore({ spawnProcess: spawnScript(ECHO_SHELL) });
  t.after(() => store.closeAll());

  const logs = store.open(
    execInput({ kind: "logs", acceptsInput: false, shell: null, dockerArgs: ["logs", "--follow", "abc123abc123"] })
  );
  assert.equal(logs.shell, null);
  assert.equal(store.write(logs.id, "rm -rf /\n"), false);

  assert.equal(store.write("does-not-exist-at-all", "ls\n"), false);
  assert.equal(store.read("does-not-exist-at-all", 0), null);

  const exec = store.open(execInput());
  assert.equal(store.close(exec.id), true);
  assert.equal(store.write(exec.id, "ls\n"), false);
  assert.equal(store.read(exec.id, 0), null);
  assert.equal(store.close(exec.id), false);
});

test("records the exit code and keeps the transcript readable afterwards", async (t) => {
  const store = createContainerSessionStore({
    spawnProcess: spawnScript("process.stdout.write('done\\n'); process.exit(3);")
  });
  t.after(() => store.closeAll());

  const session = store.open(execInput());
  await waitForChunk(store, session.id, 0);
  await delay(150);

  const read = store.read(session.id, 0);
  assert.equal(read?.running, false);
  assert.equal(read?.exitCode, 3);
  assert.equal(read?.chunk, "done\n");
});

test("caps concurrent sessions but reclaims the slots of exited ones", async (t) => {
  const store = createContainerSessionStore({
    spawnProcess: spawnScript(ECHO_SHELL),
    maxSessions: 2
  });
  t.after(() => store.closeAll());

  const first = store.open(execInput());
  store.open(execInput());
  assert.equal(store.count(), 2);

  assert.throws(() => store.open(execInput()), ContainerSessionLimitError);
  assert.throws(() => store.open(execInput()), /limit 2/);

  store.close(first.id);
  const replacement = store.open(execInput());
  assert.equal(replacement.running, true);
  assert.equal(store.count(), 2);
});

test("drops a session nobody is reading any more", async (t) => {
  const store = createContainerSessionStore({
    spawnProcess: spawnScript(ECHO_SHELL),
    idleTimeoutMs: 60
  });
  t.after(() => store.closeAll());

  const session = store.open(execInput());
  // Reading keeps it alive past the idle window.
  await delay(40);
  assert.notEqual(store.read(session.id, 0), null);
  await delay(40);
  assert.notEqual(store.read(session.id, 0), null);

  await delay(150);
  assert.equal(store.read(session.id, 0), null);
  assert.equal(store.count(), 0);
});

test("closeAll stops every process it is holding", async (t) => {
  const store = createContainerSessionStore({ spawnProcess: spawnScript(ECHO_SHELL) });
  t.after(() => store.closeAll());

  store.open(execInput());
  store.open(execInput());
  assert.equal(store.count(), 2);

  store.closeAll();
  assert.equal(store.count(), 0);
});

test("surfaces a spawn failure as session output instead of throwing", async (t) => {
  const store = createContainerSessionStore({
    spawnProcess: () => spawn("this-command-does-not-exist-anywhere", [], { stdio: ["pipe", "pipe", "pipe"] })
  });
  t.after(() => store.closeAll());

  const session = store.open(execInput());
  await delay(200);

  const read = store.read(session.id, 0);
  assert.equal(read?.running, false);
  assert.match(read?.chunk ?? "", /ENOENT|not (be )?found/i);
});
