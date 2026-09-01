import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import { killProcessTree } from "../lib/commandRunner.js";

// A session is a `docker` client process the interface keeps talking to: an interactive
// shell inside a container, or a log stream following it. Neither fits the one-shot command
// runner, which resolves once the process exits.
export type ContainerSessionKind = "exec" | "logs";

export type ContainerSessionSnapshot = {
  id: string;
  kind: ContainerSessionKind;
  containerId: string;
  containerName: string;
  shell: string | null;
  command: string;
  createdAt: string;
  running: boolean;
  exitCode: number | null;
  // Total characters this session has ever produced. The client sends back the cursor it
  // last saw and receives everything after it, so a slow poll never loses output that is
  // still inside the retained window.
  cursor: number;
};

export type ContainerSessionRead = ContainerSessionSnapshot & {
  chunk: string;
  // The requested cursor had already scrolled out of the retained window, so output
  // between it and `chunk` is gone. The interface says so rather than showing a silent gap.
  truncated: boolean;
};

export type OpenContainerSessionInput = {
  kind: ContainerSessionKind;
  containerId: string;
  containerName: string;
  dockerArgs: string[];
  shell?: string | null;
  acceptsInput: boolean;
};

export type ContainerSessionStore = {
  open: (input: OpenContainerSessionInput) => ContainerSessionSnapshot;
  read: (sessionId: string, cursor: number) => ContainerSessionRead | null;
  write: (sessionId: string, data: string) => boolean;
  close: (sessionId: string) => boolean;
  closeAll: () => void;
  count: () => number;
};

export type ContainerSessionStoreOptions = {
  spawnProcess?: (command: string, args: string[]) => ChildProcess;
  maxSessions?: number;
  idleTimeoutMs?: number;
  bufferLimit?: number;
};

export class ContainerSessionLimitError extends Error {
  readonly code = "SESSION_LIMIT";

  constructor(maxSessions: number) {
    super(`Too many open container sessions (limit ${maxSessions}). Close one and try again.`);
    this.name = "ContainerSessionLimitError";
  }
}

// Every open session holds a docker client process, so the ceiling is deliberately low: a
// forgotten dialog should not accumulate them.
const DEFAULT_MAX_SESSIONS = 8;
// Nothing has polled this session for this long, so whoever opened it is gone - a closed
// tab, a reloaded page - and the process it holds has no reader left.
const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_BUFFER_LIMIT = 200_000;

type InternalSession = {
  snapshot: Omit<ContainerSessionSnapshot, "cursor" | "running" | "exitCode">;
  child: ChildProcess;
  acceptsInput: boolean;
  text: string;
  droppedCharacters: number;
  running: boolean;
  exitCode: number | null;
  idleTimer: NodeJS.Timeout | null;
};

export function createContainerSessionStore(
  options: ContainerSessionStoreOptions = {}
): ContainerSessionStore {
  const spawnProcess =
    options.spawnProcess ??
    ((command: string, args: string[]) =>
      spawn(command, args, {
        detached: process.platform !== "win32",
        stdio: ["pipe", "pipe", "pipe"]
      }));
  const maxSessions = options.maxSessions ?? DEFAULT_MAX_SESSIONS;
  const idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
  const bufferLimit = options.bufferLimit ?? DEFAULT_BUFFER_LIMIT;
  const sessions = new Map<string, InternalSession>();

  function appendOutput(session: InternalSession, text: string): void {
    session.text += text;

    if (session.text.length > bufferLimit) {
      const overflow = session.text.length - bufferLimit;
      session.text = session.text.slice(overflow);
      session.droppedCharacters += overflow;
    }
  }

  function totalCursor(session: InternalSession): number {
    return session.droppedCharacters + session.text.length;
  }

  function toSnapshot(session: InternalSession): ContainerSessionSnapshot {
    return {
      ...session.snapshot,
      running: session.running,
      exitCode: session.exitCode,
      cursor: totalCursor(session)
    };
  }

  function stopProcess(session: InternalSession): void {
    if (!session.running) {
      return;
    }

    session.running = false;
    killProcessTree(session.child, "SIGTERM");
    const escalation = setTimeout(() => killProcessTree(session.child, "SIGKILL"), 2_000);
    escalation.unref();
  }

  function deleteSession(sessionId: string): boolean {
    const session = sessions.get(sessionId);

    if (!session) {
      return false;
    }

    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
    }

    stopProcess(session);
    sessions.delete(sessionId);

    return true;
  }

  function touch(sessionId: string, session: InternalSession): void {
    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
    }

    session.idleTimer = setTimeout(() => deleteSession(sessionId), idleTimeoutMs);
    session.idleTimer.unref();
  }

  return {
    open(input) {
      // An exited session still holds its transcript for a final read, but it holds no
      // process, so it must not stand between the user and a new one.
      for (const [sessionId, session] of sessions) {
        if (!session.running) {
          deleteSession(sessionId);
        }
      }

      if (sessions.size >= maxSessions) {
        throw new ContainerSessionLimitError(maxSessions);
      }

      const sessionId = crypto.randomBytes(18).toString("base64url");
      const child = spawnProcess("docker", input.dockerArgs);
      const session: InternalSession = {
        snapshot: {
          id: sessionId,
          kind: input.kind,
          containerId: input.containerId,
          containerName: input.containerName,
          shell: input.shell ?? null,
          command: ["docker", ...input.dockerArgs].join(" "),
          createdAt: new Date().toISOString()
        },
        child,
        acceptsInput: input.acceptsInput,
        text: "",
        droppedCharacters: 0,
        running: true,
        exitCode: null,
        idleTimer: null
      };

      // stdout and stderr share one buffer: a terminal interleaves them, and splitting
      // them here would reorder a command's output against its own error messages.
      child.stdout?.on("data", (chunk: Buffer) => appendOutput(session, chunk.toString("utf8")));
      child.stderr?.on("data", (chunk: Buffer) => appendOutput(session, chunk.toString("utf8")));
      child.on("error", (error) => {
        appendOutput(session, `\n${error.message}\n`);
        session.running = false;
      });
      child.on("exit", (exitCode) => {
        session.running = false;
        session.exitCode = exitCode;
      });

      sessions.set(sessionId, session);
      touch(sessionId, session);

      return toSnapshot(session);
    },

    read(sessionId, cursor) {
      const session = sessions.get(sessionId);

      if (!session) {
        return null;
      }

      touch(sessionId, session);

      const total = totalCursor(session);
      const requestedCursor = Number.isFinite(cursor) ? Math.max(0, Math.trunc(cursor)) : 0;
      const readableCursor = Math.min(Math.max(requestedCursor, session.droppedCharacters), total);

      return {
        ...toSnapshot(session),
        chunk: session.text.slice(readableCursor - session.droppedCharacters),
        truncated: requestedCursor < session.droppedCharacters
      };
    },

    write(sessionId, data) {
      const session = sessions.get(sessionId);

      if (!session || !session.acceptsInput || !session.running || !session.child.stdin?.writable) {
        return false;
      }

      touch(sessionId, session);
      session.child.stdin.write(data);

      return true;
    },

    close(sessionId) {
      return deleteSession(sessionId);
    },

    closeAll() {
      for (const sessionId of [...sessions.keys()]) {
        deleteSession(sessionId);
      }
    },

    count() {
      return sessions.size;
    }
  };
}
