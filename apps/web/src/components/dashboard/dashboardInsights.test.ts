import { describe, expect, it } from "vitest";
import { createProjectFixture } from "../../test/projectFixture";
import type { DockerContainersResponse } from "../../types/docker";
import type { WorkflowRun } from "../../types/workflows";
import {
  buildAttentionQueue,
  buildWorkspaceSummary,
  getContainerHealth,
  getResumeProjects,
  pushRecentProjectId
} from "./dashboardInsights";

function createRun(overrides: Partial<WorkflowRun>): WorkflowRun {
  return {
    id: "run-1",
    workflowId: "workflow-1",
    workflowName: "Nightly fetch",
    mode: "run",
    status: "success",
    startedAt: "2026-09-01T10:00:00.000Z",
    completedAt: "2026-09-01T10:01:00.000Z",
    durationMs: 60_000,
    steps: [],
    summary: { selectedProjects: 1, succeeded: 1, failed: 0, skipped: 0, commands: 1 },
    statusMessage: null,
    ...overrides
  };
}

const dockerStatus: DockerContainersResponse = {
  ok: true,
  checkedAt: "2026-09-01T10:00:00.000Z",
  error: null,
  containers: [],
  groups: [
    {
      id: "billing",
      name: "billing",
      composeProject: "billing",
      workingDir: "/workspace/billing/",
      containers: [
        { id: "a", name: "billing-api", image: "api", status: "Up 3 minutes (unhealthy)", ports: "", runningFor: "3 minutes", composeProject: "billing", composeService: "api", composeWorkingDir: "/workspace/billing" },
        { id: "b", name: "billing-db", image: "db", status: "Up 3 minutes (healthy)", ports: "", runningFor: "3 minutes", composeProject: "billing", composeService: "db", composeWorkingDir: "/workspace/billing" }
      ]
    },
    {
      id: "standalone",
      name: "cache",
      composeProject: null,
      workingDir: null,
      containers: [
        { id: "c", name: "cache", image: "redis", status: "Restarting (1) 2 seconds ago", ports: "", runningFor: "", composeProject: null, composeService: null, composeWorkingDir: null }
      ]
    }
  ]
};

describe("dashboardInsights", () => {
  it("summarises the workspace with exclusive in-sync counting", () => {
    const summary = buildWorkspaceSummary([
      createProjectFixture("clean"),
      createProjectFixture("ahead", { ahead: 2 }),
      createProjectFixture("behind", { behind: 1 }),
      createProjectFixture("dirty", { isClean: false, staged: 1, modified: 2, untracked: 3 })
    ]);

    expect(summary).toEqual({ total: 4, inSync: 1, dirty: 1, behind: 1, ahead: 1, localChanges: 6, attention: 2 });
  });

  it("reads container health from the docker ps status text", () => {
    expect(getContainerHealth({ status: "Up 3 minutes (unhealthy)" })).toBe("unhealthy");
    expect(getContainerHealth({ status: "Up 3 minutes (health: starting)" })).toBe("restarting");
    expect(getContainerHealth({ status: "Up 3 minutes (healthy)" })).toBe("healthy");
    expect(getContainerHealth({ status: "Up 3 minutes" })).toBe("running");
    expect(getContainerHealth({ status: "" })).toBe("unknown");
  });

  it("orders the attention queue by severity, then by how much there is to do", () => {
    const projects = [
      createProjectFixture("billing", { path: "/workspace/billing", isClean: false, modified: 1 }),
      createProjectFixture("web", { behind: 2, isClean: false, staged: 1, untracked: 4 }),
      createProjectFixture("infra", { isClean: false, modified: 7 }),
      createProjectFixture("docs", { ahead: 1 }),
      createProjectFixture("clean"),
      createProjectFixture("local-only", { upstream: null })
    ];
    const runs = [
      createRun({ id: "old", status: "failed", startedAt: "2026-08-30T10:00:00.000Z" }),
      createRun({ id: "latest", status: "interrupted", startedAt: "2026-09-01T10:00:00.000Z", completedAt: "2026-09-01T10:00:01.000Z" }),
      createRun({ id: "dry", workflowId: "workflow-2", workflowName: "Preview", mode: "dry-run", status: "failed" })
    ];

    const queue = buildAttentionQueue({ projects, dockerStatus, runs });

    expect(queue.map((item) => item.id)).toEqual([
      "container:billing",
      "container:standalone",
      "project:web",
      "run:latest",
      "project:infra",
      "project:billing",
      "project:docs"
    ]);
    expect(queue[0]).toMatchObject({
      severity: "critical",
      context: "billing",
      reasons: [{ kind: "containersUnhealthy", count: 1 }],
      target: { type: "project", projectId: "billing" }
    });
    expect(queue[1]).toMatchObject({ severity: "warning", target: { type: "section", section: "docker" } });
    expect(queue[2].reasons).toEqual([
      { kind: "behind", count: 2 },
      { kind: "changes", staged: 1, modified: 0, untracked: 4 }
    ]);
    expect(queue[3]).toMatchObject({ severity: "action", reasons: [{ kind: "runInterrupted", startedAt: "2026-09-01T10:00:00.000Z" }] });
    expect(queue.at(-1)).toMatchObject({ severity: "info", reasons: [{ kind: "ahead", count: 1 }] });
  });

  it("ignores Docker when the daemon is unavailable", () => {
    const queue = buildAttentionQueue({
      projects: [createProjectFixture("clean")],
      dockerStatus: { ok: false, containers: [], groups: [], checkedAt: "", error: "offline" },
      runs: []
    });
    expect(queue).toEqual([]);
  });

  it("builds the resume list from recents, then favorites, then the newest commits", () => {
    const projects = [
      createProjectFixture("alpha", { lastCommit: { hash: "1", message: "a", date: "2026-09-01T09:00:00.000Z", author: "A" } }),
      createProjectFixture("beta", { lastCommit: { hash: "2", message: "b", date: "2026-09-02T09:00:00.000Z", author: "B" } }),
      createProjectFixture("gamma"),
      createProjectFixture("delta", { lastCommit: { hash: "4", message: "d", date: "2026-08-01T09:00:00.000Z", author: "D" } })
    ];

    const entries = getResumeProjects(projects, ["gamma", "missing", "beta"], ["beta", "alpha"], 10);
    expect(entries.map((entry) => [entry.project.id, entry.source])).toEqual([
      ["gamma", "recent"],
      ["beta", "recent"],
      ["alpha", "favorite"],
      ["delta", "commit"]
    ]);
    expect(getResumeProjects(projects, [], [], 2).map((entry) => entry.project.id)).toEqual(["beta", "alpha"]);
  });

  it("keeps recents most-recent-first, unique and capped", () => {
    expect(pushRecentProjectId(["b", "a"], "a", 3)).toEqual(["a", "b"]);
    expect(pushRecentProjectId(["c", "b", "a"], "d", 3)).toEqual(["d", "c", "b"]);
  });
});
