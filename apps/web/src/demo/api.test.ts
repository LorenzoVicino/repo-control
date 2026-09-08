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
