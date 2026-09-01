import crypto from "node:crypto";
import type { ServerEnv } from "../config/env.js";
import { readSessionCookie } from "../lib/sessionCookie.js";

// A browser tab left open all day should not have to sign in again, while a laptop that is
// closed for the weekend should. Sessions live in process memory only, so restarting the
// server also ends them.
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const REMEMBERED_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Loopback binding and the Host check keep other machines out, but a local process can
// still hammer the login route. Five wrong answers buy a short pause, which costs a
// mistyping owner a few seconds and makes guessing a password impractical.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

export type AuthSessionState = {
  authRequired: boolean;
  authenticated: boolean;
  username: string | null;
};

export type LoginResult =
  | { ok: true; token: string; ttlMs: number }
  | { ok: false; reason: "disabled" }
  | { ok: false; reason: "invalid" }
  | { ok: false; reason: "locked"; retryAfterMs: number };

export type AuthCredentials = {
  username: string;
  password: string;
  remember?: boolean;
};

export type AuthGuard = {
  readonly enabled: boolean;
  readonly username: string | null;
  login: (credentials: AuthCredentials) => LoginResult;
  readSessionState: (cookieHeader: string | undefined) => AuthSessionState;
  isAuthenticatedRequest: (cookieHeader: string | undefined) => boolean;
  revokeRequestSession: (cookieHeader: string | undefined) => void;
};

type AuthEnv = Pick<ServerEnv, "REPO_CONTROL_AUTH_USERNAME" | "REPO_CONTROL_AUTH_PASSWORD">;

export function createAuthGuard(env: AuthEnv, now: () => number = Date.now): AuthGuard {
  const configuredUsername = env.REPO_CONTROL_AUTH_USERNAME ?? null;
  const configuredPassword = env.REPO_CONTROL_AUTH_PASSWORD ?? null;
  const enabled = configuredUsername !== null && configuredPassword !== null;
  // Token digests, never the tokens themselves: a heap dump or a stray log of this map
  // cannot be replayed as a session.
  const sessions = new Map<string, number>();
  let failedAttempts = 0;
  let lockedUntil = 0;

  function pruneExpiredSessions(): void {
    const currentTime = now();

    for (const [digest, expiresAt] of sessions) {
      if (expiresAt <= currentTime) {
        sessions.delete(digest);
      }
    }
  }

  function isAuthenticatedToken(token: string | null): boolean {
    // With no credentials configured every caller is already authorized; the dashboard
    // never shows the sign-in screen in that mode.
    if (!enabled) {
      return true;
    }

    if (!token) {
      return false;
    }

    pruneExpiredSessions();

    const expiresAt = sessions.get(hashToken(token));
    return expiresAt !== undefined && expiresAt > now();
  }

  return {
    enabled,
    username: enabled ? configuredUsername : null,

    login(credentials) {
      if (!enabled || configuredUsername === null || configuredPassword === null) {
        return { ok: false, reason: "disabled" };
      }

      const currentTime = now();

      if (lockedUntil > currentTime) {
        return { ok: false, reason: "locked", retryAfterMs: lockedUntil - currentTime };
      }

      // Both comparisons always run: returning early on a wrong username would leak which
      // half of the pair matched through the response time.
      const usernameMatches = matchesSecret(configuredUsername, credentials.username);
      const passwordMatches = matchesSecret(configuredPassword, credentials.password);

      if (!usernameMatches || !passwordMatches) {
        failedAttempts += 1;

        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
          failedAttempts = 0;
          lockedUntil = currentTime + LOCKOUT_MS;

          return { ok: false, reason: "locked", retryAfterMs: LOCKOUT_MS };
        }

        return { ok: false, reason: "invalid" };
      }

      failedAttempts = 0;
      lockedUntil = 0;
      pruneExpiredSessions();

      const token = crypto.randomBytes(32).toString("base64url");
      const ttlMs = credentials.remember ? REMEMBERED_SESSION_TTL_MS : SESSION_TTL_MS;
      sessions.set(hashToken(token), currentTime + ttlMs);

      return { ok: true, token, ttlMs };
    },

    readSessionState(cookieHeader) {
      const authenticated = isAuthenticatedToken(readSessionCookie(cookieHeader));

      return {
        authRequired: enabled,
        authenticated,
        username: enabled && authenticated ? configuredUsername : null
      };
    },

    isAuthenticatedRequest(cookieHeader) {
      return isAuthenticatedToken(readSessionCookie(cookieHeader));
    },

    revokeRequestSession(cookieHeader) {
      const token = readSessionCookie(cookieHeader);

      if (token) {
        sessions.delete(hashToken(token));
      }
    }
  };
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Comparing digests rather than the raw values keeps the comparison constant-time even
// when the submitted value has a different length than the configured one.
function matchesSecret(expected: string, received: string): boolean {
  return crypto.timingSafeEqual(
    crypto.createHash("sha256").update(expected, "utf8").digest(),
    crypto.createHash("sha256").update(received, "utf8").digest()
  );
}
