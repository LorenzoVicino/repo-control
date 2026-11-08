import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Who may call the HTTP MCP endpoint, and with which tools. The endpoint is not behind the
// dashboard's sign-in (MCP clients do not hold a browser session), so every request has to
// present a bearer token:
// - external clients use the one token configured in the environment;
// - each in-app agent run gets a token of its own, valid only while that run lives, which
//   also carries the run's approval channel.

export type ApprovalRequest = { toolName: string; input: Record<string, unknown> };
export type ApprovalDecision = { behavior: "allow" } | { behavior: "deny"; message: string };
export type RequestApproval = (request: ApprovalRequest) => Promise<ApprovalDecision>;

export type McpAccess =
  | { client: "external"; allowWrites: boolean }
  | { client: "agent"; allowWrites: true; requestApproval: RequestApproval };

export type AgentGrant = { token: string; revoke: () => void };

export type McpAccessControl = {
  /** Whether any token can currently be accepted, i.e. whether the endpoint is live. */
  enabled: () => boolean;
  authorize: (authorizationHeader: string | undefined) => McpAccess | null;
  issueAgentToken: (requestApproval: RequestApproval) => AgentGrant;
};

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function createMcpAccessControl({ externalToken, externalWrites }: { externalToken?: string; externalWrites: boolean }): McpAccessControl {
  const externalDigest = externalToken ? digest(externalToken) : null;
  // Keyed by the hex digest, so the raw agent tokens are never kept in memory.
  const agentGrants = new Map<string, RequestApproval>();

  return {
    enabled: () => externalDigest !== null || agentGrants.size > 0,

    authorize(authorizationHeader) {
      const match = /^Bearer\s+(\S+)\s*$/i.exec(authorizationHeader ?? "");
      if (!match) return null;
      const presented = digest(match[1]);

      const requestApproval = agentGrants.get(presented.toString("hex"));
      if (requestApproval) return { client: "agent", allowWrites: true, requestApproval };

      // Comparing fixed-length digests keeps the check constant-time whatever the input length.
      if (externalDigest && timingSafeEqual(presented, externalDigest)) return { client: "external", allowWrites: externalWrites };
      return null;
    },

    issueAgentToken(requestApproval) {
      const token = randomBytes(32).toString("base64url");
      const key = digest(token).toString("hex");
      agentGrants.set(key, requestApproval);
      return { token, revoke: () => agentGrants.delete(key) };
    }
  };
}
