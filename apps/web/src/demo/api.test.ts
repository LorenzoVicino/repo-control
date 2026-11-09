import { beforeEach, expect, it, vi } from "vitest";
import type { demoRequest as Request } from "./api";
let request: typeof Request;
beforeEach(async () => {
  vi.resetModules();
  request = (await import("./api")).demoRequest;
});
const post = (body = {}) => ({ method: "POST", body: JSON.stringify(body) });
it("stages and commits a file, updates its repository summary, and never calls the network", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const { projects } = await (await request("/api/projects")).json();
  const id = projects[0].id;
  const route = `/api/projects/${id}`;
  await request(`${route}/git/stage-all`, post());
  expect((await (await request(`${route}/summary`)).json()).staged).toBe(1);
  await request(`${route}/git/commit`, post({ message: "Improve onboarding" }));
  const summary = await (await request(`${route}/summary`)).json();
  expect(summary.isClean).toBe(true);
  expect(summary.ahead).toBe(1);
  expect(summary.lastCommit.message).toBe("Improve onboarding");
  await request(`${route}/git/push`, post());
  expect((await (await request(`${route}/summary`)).json()).ahead).toBe(0);
  expect(
    (await request(`${route}/terminal/run`, post({ command: "rm -rf /" })))
      .status,
  ).toBe(409);
  expect((await request("/api/unknown")).status).toBe(409);
  expect(fetch).not.toHaveBeenCalled();
});
it("serves the dashboard, sessions, diffs, containers and preferences with coherent shapes", async () => {
  for (const route of [
    "auth/session",
    "health",
    "setup",
    "setup/tools",
    "preferences",
    "app/update-status",
    "agent-sessions",
    "docker/containers",
    "docker/stats",
    "workflows",
    "workflow-runs",
  ])
    expect((await request(`/api/${route}`)).ok).toBe(true);
  const { projects } = await (await request("/api/projects")).json();
  for (const project of projects) {
    for (const action of [
      "summary",
      "git/details",
      "git/activity",
      "git/diff?path=README.md&staged=true",
      "docker/compose",
      "docker/logs",
      "terminal/suggestions",
    ])
      expect((await request(`/api/projects/${project.id}/${action}`)).ok).toBe(
        true,
      );
  }
  await request("/api/setup", { method: "PUT" });
  expect((await (await request("/api/setup")).json()).completed).toBe(true);
  await request("/api/preferences", {
    method: "PUT",
    body: JSON.stringify({ favoriteProjectIds: [] }),
  });
  expect(
    (await (await request("/api/preferences")).json()).favoriteProjectIds,
  ).toEqual([]);
  expect(
    (await (await request("/api/agent-sessions?search=keyboard")).json())
      .sessions,
  ).toHaveLength(1);
});
it("previews, executes and cancels the sample automation", async () => {
  vi.useFakeTimers();
  try {
    const preview = await (
      await request("/api/workflows/demo-fetch/dry-run", post())
    ).json();
    expect(preview.status).toBe("success");
    expect(preview.steps).toHaveLength(7);
    const run = await (
      await request("/api/workflows/demo-fetch/run", post())
    ).json();
    expect(run.status).toBe("running");
    await vi.advanceTimersByTimeAsync(2000);
    expect(
      (await (await request(`/api/workflow-runs/${run.id}`)).json()).status,
    ).toBe("success");
    const cancelled = await (
      await request("/api/workflows/demo-fetch/run", post())
    ).json();
    await request(`/api/workflow-runs/${cancelled.id}/cancel`, post());
    await vi.advanceTimersByTimeAsync(2000);
    expect(
      (await (await request(`/api/workflow-runs/${cancelled.id}`)).json())
        .status,
    ).toBe("cancelled");
  } finally {
    vi.useRealTimers();
  }
});

it("serves the scripted agent and applies an approved pull to the demo workspace", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  vi.useFakeTimers();
  try {
    const { demoSubscribeToAgentRun } = await import("./api");
    expect(await (await request("/api/agent")).json()).toEqual({ available: true, command: "claude", model: "demo replay" });
    const started = await request("/api/agent/runs", post({ prompt: "pull documentation" }));
    expect(started.status).toBe(202);
    const run = await started.json();

    let approvalId = "";
    let ended = false;
    demoSubscribeToAgentRun(run.id, -1, {
      onEvent: (event) => {
        if (event.type === "approval_request") approvalId = event.approvalId;
      },
      onEnd: () => (ended = true),
      onError: () => {}
    });
    await vi.waitFor(async () => {
      await vi.advanceTimersByTimeAsync(500);
      expect(approvalId).not.toBe("");
    });
    expect((await request(`/api/agent/runs/${run.id}/approvals/other`, post({ behavior: "allow" }))).status).toBe(409);
    expect((await request(`/api/agent/runs/${run.id}/approvals/${approvalId}`, post({ behavior: "allow" }))).status).toBe(200);
    await vi.waitFor(async () => {
      await vi.advanceTimersByTimeAsync(500);
      expect(ended).toBe(true);
    });

    const { projects } = await (await request("/api/projects")).json();
    expect(projects.find((project: { name: string }) => project.name === "documentation").behind).toBe(0);
    expect((await request(`/api/agent/runs/${run.id}/cancel`, post())).status).toBe(409);
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

it("serves a demo knowledge index with labels and highlighted search", async () => {
  const status = await (await request("/api/knowledge")).json();
  expect(status).toMatchObject({ state: "idle", indexed: 7, semantic: { enabled: false, installable: false } });
  const { repositories } = await (await request("/api/knowledge/repositories")).json();
  expect(repositories.find((repository: { name: string }) => repository.name === "atlas-api").labels.map((label: { id: string }) => label.id)).toContain("fastify");
  const { hits } = await (await request("/api/knowledge/search?q=invoices")).json();
  expect(hits[0]).toMatchObject({ name: "billing-worker", via: ["text"] });
  expect(hits[0].matches[0].snippet).toContain("«invoices»");
  const byLabel = (await (await request("/api/knowledge/search?q=fastify")).json()).hits;
  expect(byLabel[0]).toMatchObject({ name: "atlas-api" });
  expect(byLabel[0].via).toContain("label");
  expect((await (await request("/api/knowledge/search?q=?")).json()).hits).toEqual([]);
  expect((await request("/api/knowledge/semantic", post())).status).toBe(409);
});

it("serves a demo workspace graph with dependencies, mentions and label nodes", async () => {
  const graph = await (await request("/api/knowledge/graph")).json();
  const name = (id: string) => graph.nodes.find((node: { id: string; name: string }) => node.id === id)?.name;
  const relations = graph.edges.filter((edge: { type: string }) => edge.type !== "labelled").map((edge: { type: string; source: string; target: string }) => `${edge.type} ${name(edge.source)}->${name(edge.target)}`);
  expect(relations).toContain("depends_on atlas-web->shared-utils");
  expect(relations).toContain("references documentation->billing-worker");
  expect(graph.nodes.filter((node: { type: string }) => node.type === "repository")).toHaveLength(7);
  expect(graph.nodes.some((node: { type: string; name: string }) => node.type === "label" && node.name === "typescript")).toBe(true);
  expect(graph.nodes.some((node: { name: string }) => node.name === "tests")).toBe(false);
});
