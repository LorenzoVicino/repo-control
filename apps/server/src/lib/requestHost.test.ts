import assert from "node:assert/strict";
import { test } from "node:test";
import { getAllowedHostnames, getRequestHostname, isAllowedRequestHost } from "./requestHost.js";

test("parses hostnames out of Host headers, including IPv6 literals and ports", () => {
  assert.equal(getRequestHostname("127.0.0.1:3747"), "127.0.0.1");
  assert.equal(getRequestHostname("localhost"), "localhost");
  assert.equal(getRequestHostname("LOCALHOST:5173"), "localhost");
  assert.equal(getRequestHostname("[::1]:3747"), "::1");
  assert.equal(getRequestHostname("[::1]"), "::1");
  assert.equal(getRequestHostname("  127.0.0.1:3747  "), "127.0.0.1");
  assert.equal(getRequestHostname(undefined), null);
  assert.equal(getRequestHostname(""), null);
  assert.equal(getRequestHostname("   "), null);
  assert.equal(getRequestHostname("[]"), null);
});

test("accepts loopback names and the configured bind host, and rejects everything else", () => {
  const allowed = getAllowedHostnames("127.0.0.1");

  assert.equal(isAllowedRequestHost("127.0.0.1:3747", allowed), true);
  assert.equal(isAllowedRequestHost("localhost:3747", allowed), true);
  assert.equal(isAllowedRequestHost("[::1]:3747", allowed), true);

  // A rebound request carries the attacker's own hostname in Host.
  assert.equal(isAllowedRequestHost("attacker.example:3747", allowed), false);
  assert.equal(isAllowedRequestHost("127.0.0.1.attacker.example", allowed), false);
  assert.equal(isAllowedRequestHost("localhost.attacker.example", allowed), false);
  // A missing Host header cannot be verified, so it is not trusted either.
  assert.equal(isAllowedRequestHost(undefined, allowed), false);
});

test("includes the bind host and any explicitly allowed extra hosts", () => {
  const allowed = getAllowedHostnames("192.168.1.10", "repo-control.lan, Workstation.local");

  assert.equal(isAllowedRequestHost("192.168.1.10:3747", allowed), true);
  assert.equal(isAllowedRequestHost("repo-control.lan:3747", allowed), true);
  assert.equal(isAllowedRequestHost("workstation.local", allowed), true);
  assert.equal(isAllowedRequestHost("attacker.example", allowed), false);
  // Loopback stays valid regardless of the bind host.
  assert.equal(isAllowedRequestHost("127.0.0.1:3747", allowed), true);
});
