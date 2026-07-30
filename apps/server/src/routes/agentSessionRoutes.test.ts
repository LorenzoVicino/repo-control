import assert from "node:assert/strict";
import Fastify from "fastify";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createProjectResolver } from "../lib/projectResolver.js";
import { registerAgentSessionRoutes } from "./agentSessionRoutes.js";

test("validates a known session before opening its resume command", async (context) => {
  const rootPath = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-agent-routes-"));
  const projectPath = path.join(rootPath, "product");
  const projectId = Buffer.from("product").toString("base64url");
  const sessionId = "11111111-1111-4111-8111-111111111111";
  const launched: Array<{ cwd: string; command: string; args: string[] }> = [];
  const scanSearchTerms: Array<string | undefined> = [];
  const app = Fastify();

  await fs.mkdir(path.join(projectPath, ".git"), { recursive: true });
  context.after(async () => {
    await app.close();
    await fs.rm(rootPath, { recursive: true, force: true });
  });

  await registerAgentSessionRoutes(app, {
    ...createProjectResolver(rootPath),
    scanProjects: async () => [{
      id: projectId,
      name: "product",
      path: projectPath,
      branch: "main",
      isClean: true,
      staged: 0,
      modified: 0,
      untracked: 0,
      ahead: 0,
      behind: 0,
      upstream: null,
      lastCommit: null,
      hasDockerCompose: false
    }],
    scanAgentSessions: async (_rootPath, _projects, options) => {
      scanSearchTerms.push(options?.searchTerm);

      return {
      root: rootPath,
      agents: [{
        id: "codex",
        label: "Codex",
        installed: true,
        used: true,
        command: "codex",
        sessionCount: 1
      }],
      sessions: [{
        id: sessionId,
        provider: "codex",
        providerLabel: "Codex",
        projectId,
        projectName: "product",
        projectPath,
        title: "Build feature",
        preview: "Build feature",
        branch: "main",
        startedAt: null,
        updatedAt: null,
        match: null
      }],
      scannedAt: new Date().toISOString(),
      warnings: []
      };
    },
    openNativeTerminal: async (cwd, spec) => {
      launched.push({ cwd, command: spec.command, args: spec.args });
      return {
        ok: true,
        message: "opened",
        command: spec.displayCommand
      };
    }
  });

  const searchResponse = await app.inject({
    method: "GET",
    url: "/api/agent-sessions?search=retry%20budget"
  });

  assert.equal(searchResponse.statusCode, 200);
  assert.equal(scanSearchTerms[0], "retry budget");

  const response = await app.inject({
    method: "POST",
    url: `/api/agent-sessions/codex/${sessionId}/resume`,
    payload: { projectId }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(launched, [{
    cwd: projectPath,
    command: "codex",
    args: ["resume", sessionId]
  }]);

  const unknownResponse = await app.inject({
    method: "POST",
    url: "/api/agent-sessions/codex/99999999-9999-4999-8999-999999999999/resume",
    payload: { projectId }
  });

  assert.equal(unknownResponse.statusCode, 404);
  assert.equal(launched.length, 1);
});
