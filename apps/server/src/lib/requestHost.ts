// Binding to 127.0.0.1 keeps the API off the network, but it does not stop a browser
// from reaching it: a page on any origin can be pointed at 127.0.0.1 by re-resolving its
// own hostname (DNS rebinding). The browser then treats the request as same-origin, so
// CORS never runs and the Origin allowlist is not consulted. What still differs is the
// Host header - it carries the attacker's hostname, not a loopback address. Validating it
// is the check that actually holds.

const DEFAULT_ALLOWED_HOSTNAMES = ["127.0.0.1", "localhost", "::1"];

export function getRequestHostname(hostHeader: string | undefined): string | null {
  if (!hostHeader) {
    return null;
  }

  const trimmedHost = hostHeader.trim();

  if (!trimmedHost) {
    return null;
  }

  // IPv6 literals arrive bracketed, optionally with a port: "[::1]" or "[::1]:3747".
  if (trimmedHost.startsWith("[")) {
    const closingBracketIndex = trimmedHost.indexOf("]");
    return closingBracketIndex > 1 ? trimmedHost.slice(1, closingBracketIndex).toLowerCase() : null;
  }

  const [hostname] = trimmedHost.split(":");
  return hostname ? hostname.toLowerCase() : null;
}

export function getAllowedHostnames(bindHost: string, extraHosts?: string): ReadonlySet<string> {
  const configuredHosts = (extraHosts ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  return new Set([...DEFAULT_ALLOWED_HOSTNAMES, bindHost.trim().toLowerCase(), ...configuredHosts]);
}

export function isAllowedRequestHost(
  hostHeader: string | undefined,
  allowedHostnames: ReadonlySet<string>
): boolean {
  const hostname = getRequestHostname(hostHeader);
  return hostname !== null && allowedHostnames.has(hostname);
}
