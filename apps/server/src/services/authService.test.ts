import assert from "node:assert/strict";
import test from "node:test";
import { SESSION_COOKIE_NAME } from "../lib/sessionCookie.js";
import {
  createAuthGuard,
  REMEMBERED_SESSION_TTL_MS,
  SESSION_TTL_MS
} from "./authService.js";

const CREDENTIALS = {
  REPO_CONTROL_AUTH_USERNAME: "owner",
  REPO_CONTROL_AUTH_PASSWORD: "correct horse battery staple"
};

function cookieFor(token: string): string {
  return `${SESSION_COOKIE_NAME}=${token}`;
}

function signIn(guard: ReturnType<typeof createAuthGuard>, remember = false): string {
  const result = guard.login({ ...credentialsInput(), remember });
  assert.equal(result.ok, true);

  return result.ok ? result.token : "";
}

function credentialsInput() {
  return {
    username: CREDENTIALS.REPO_CONTROL_AUTH_USERNAME,
    password: CREDENTIALS.REPO_CONTROL_AUTH_PASSWORD
  };
}

test("authorizes everything when no credentials are configured", () => {
  const guard = createAuthGuard({
    REPO_CONTROL_AUTH_USERNAME: undefined,
    REPO_CONTROL_AUTH_PASSWORD: undefined
  });

  assert.equal(guard.enabled, false);
  assert.equal(guard.username, null);
  assert.equal(guard.isAuthenticatedRequest(undefined), true);
  assert.deepEqual(guard.readSessionState(undefined), {
    authRequired: false,
    authenticated: true,
    username: null
  });
  assert.deepEqual(guard.login(credentialsInput()), { ok: false, reason: "disabled" });
});

test("accepts the configured pair and rejects every near miss", () => {
  const guard = createAuthGuard(CREDENTIALS);

  assert.equal(guard.enabled, true);
  assert.equal(guard.username, "owner");
  assert.deepEqual(guard.readSessionState(undefined), {
    authRequired: true,
    authenticated: false,
    username: null
  });

  for (const attempt of [
    { username: "owner", password: "wrong" },
    { username: "other", password: CREDENTIALS.REPO_CONTROL_AUTH_PASSWORD },
    { username: "Owner", password: CREDENTIALS.REPO_CONTROL_AUTH_PASSWORD },
    { username: "owner", password: "correct horse battery stapl" }
  ]) {
    assert.deepEqual(guard.login(attempt), { ok: false, reason: "invalid" }, JSON.stringify(attempt));
  }

  const result = guard.login(credentialsInput());
  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.ttlMs, SESSION_TTL_MS);
    assert.match(result.token, /^[\w-]{32,}$/);
    assert.deepEqual(guard.readSessionState(cookieFor(result.token)), {
      authRequired: true,
      authenticated: true,
      username: "owner"
    });
  }
});

test("hands out a longer session only when sign-in asks to be remembered", () => {
  const guard = createAuthGuard(CREDENTIALS);
  const standard = guard.login(credentialsInput());
  const remembered = guard.login({ ...credentialsInput(), remember: true });

  assert.equal(standard.ok && standard.ttlMs, SESSION_TTL_MS);
  assert.equal(remembered.ok && remembered.ttlMs, REMEMBERED_SESSION_TTL_MS);
});

test("issues one session per sign-in and only invalidates the one that signs out", () => {
  const guard = createAuthGuard(CREDENTIALS);
  const firstToken = signIn(guard);
  const secondToken = signIn(guard);

  assert.notEqual(firstToken, secondToken);

  guard.revokeRequestSession(cookieFor(firstToken));

  assert.equal(guard.isAuthenticatedRequest(cookieFor(firstToken)), false);
  assert.equal(guard.isAuthenticatedRequest(cookieFor(secondToken)), true);
  // Signing out without a cookie must not throw or drop anyone else's session.
  guard.revokeRequestSession(undefined);
  assert.equal(guard.isAuthenticatedRequest(cookieFor(secondToken)), true);
});

test("rejects an unknown, empty or expired token", () => {
  let currentTime = 1_000;
  const guard = createAuthGuard(CREDENTIALS, () => currentTime);
  const token = signIn(guard);

  assert.equal(guard.isAuthenticatedRequest(cookieFor("not-a-token")), false);
  assert.equal(guard.isAuthenticatedRequest(undefined), false);
  assert.equal(guard.isAuthenticatedRequest(cookieFor(token)), true);

  currentTime += SESSION_TTL_MS - 1;
  assert.equal(guard.isAuthenticatedRequest(cookieFor(token)), true);

  currentTime += 1;
  assert.equal(guard.isAuthenticatedRequest(cookieFor(token)), false);
});

test("locks sign-in briefly after repeated failures, then reopens it", () => {
  let currentTime = 5_000;
  const guard = createAuthGuard(CREDENTIALS, () => currentTime);

  for (let attempt = 1; attempt < 5; attempt += 1) {
    assert.deepEqual(guard.login({ username: "owner", password: "wrong" }), {
      ok: false,
      reason: "invalid"
    });
  }

  const locked = guard.login({ username: "owner", password: "wrong" });
  assert.equal(locked.ok, false);
  assert.equal(locked.ok === false && locked.reason, "locked");
  const retryAfterMs = locked.ok === false && locked.reason === "locked" ? locked.retryAfterMs : 0;
  assert.equal(retryAfterMs > 0, true);

  // The correct credentials are refused too, otherwise the lock would not slow anything down.
  const duringLock = guard.login(credentialsInput());
  assert.equal(duringLock.ok === false && duringLock.reason, "locked");

  currentTime += retryAfterMs;
  assert.equal(guard.login(credentialsInput()).ok, true);
});

test("forgives failures once a sign-in succeeds", () => {
  const guard = createAuthGuard(CREDENTIALS);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    guard.login({ username: "owner", password: "wrong" });
  }

  assert.equal(guard.login(credentialsInput()).ok, true);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    assert.deepEqual(guard.login({ username: "owner", password: "wrong" }), {
      ok: false,
      reason: "invalid"
    });
  }
});
