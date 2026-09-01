// The API needs exactly one opaque cookie, so it serializes and parses that single header
// itself instead of adding a cookie plugin to the handful of packages an install pulls at
// runtime. Session tokens are base64url, which needs no cookie quoting or escaping.

export const SESSION_COOKIE_NAME = "repo_control_session";

export function readSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const pair of cookieHeader.split(";")) {
    const separatorIndex = pair.indexOf("=");

    if (separatorIndex < 1) {
      continue;
    }

    if (pair.slice(0, separatorIndex).trim() !== SESSION_COOKIE_NAME) {
      continue;
    }

    const value = pair.slice(separatorIndex + 1).trim();
    return value || null;
  }

  return null;
}

export function serializeSessionCookie(token: string, maxAgeSeconds: number): string {
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    // HttpOnly keeps the token out of reach of page scripts, and SameSite=Strict keeps it
    // off cross-site requests, so a page on another origin cannot act as the signed-in
    // user even if it guesses an API path. Secure is deliberately absent: the supported
    // deployment is plain HTTP on loopback, where a Secure cookie would never be sent.
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ].join("; ");
}

export function serializeClearedSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}
