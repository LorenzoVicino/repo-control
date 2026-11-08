import { createHash, timingSafeEqual } from "node:crypto";

// Who may call the HTTP MCP endpoint, and with which tools. The endpoint is not behind the
// dashboard's sign-in (MCP clients do not hold a browser session), so every request has to
// present a bearer token. External clients use the one token configured in the environment;
// the in-app agent will receive short-lived tokens of its own.

export type McpAccess = { client: "external"; allowWrites: boolean };

export type McpAccessControl = {
  /** Whether any token can currently be accepted, i.e. whether the endpoint is live. */
  enabled: () => boolean;
  authorize: (authorizationHeader: string | undefined) => McpAccess | null;
};

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function createMcpAccessControl({ externalToken, externalWrites }: { externalToken?: string; externalWrites: boolean }): McpAccessControl {
  const externalDigest = externalToken ? digest(externalToken) : null;

  return {
    enabled: () => externalDigest !== null,
    authorize(authorizationHeader) {
      const match = /^Bearer\s+(\S+)\s*$/i.exec(authorizationHeader ?? "");
      if (!match || !externalDigest) return null;
      // Comparing fixed-length digests keeps the check constant-time whatever the input length.
      return timingSafeEqual(digest(match[1]), externalDigest) ? { client: "external", allowWrites: externalWrites } : null;
    }
  };
}
