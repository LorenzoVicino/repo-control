import { describe, expect, it } from "vitest";
import { createProjectFixture } from "../../test/projectFixture";
import type { DockerContainersResponse } from "../../types/docker";
import { buildDashboardSnapshot } from "./dashboardInsights";

describe("buildDashboardSnapshot", () => {
  it("derives health, change load, recency and Docker metrics", () => {
    const projects = [
      createProjectFixture("healthy", {
        lastCommit: { hash: "1", message: "latest", date: "2026-07-20T10:00:00.000Z", author: "A" }
      }),
      createProjectFixture("dirty", {
        isClean: false,
        staged: 1,
        modified: 2,
        untracked: 3,
        lastCommit: { hash: "2", message: "older", date: "2026-07-19T10:00:00.000Z", author: "B" }
      }),
      createProjectFixture("behind", { behind: 1, ahead: 2 })
    ];
    const dockerStatus: DockerContainersResponse = {
      ok: true,
      containers: [{
        id: "container-1",
        name: "api",
        image: "api:latest",
        status: "running",
        ports: "",
        runningFor: "1 minute",
        composeProject: "fixture",
        composeService: "api",
        composeWorkingDir: "/workspace",
      }],
      groups: [{
        id: "fixture",
        name: "fixture",
        composeProject: "fixture",
        workingDir: "/workspace",
        containers: []
      }],
      checkedAt: "2026-07-20T10:00:00.000Z",
      error: null
    };

    const snapshot = buildDashboardSnapshot(projects, ["dirty"], dockerStatus);

    expect(snapshot).toMatchObject({
      total: 3,
      healthy: 1,
      dirty: 1,
      behind: 1,
      ahead: 1,
      favorite: 1,
      localChanges: 6,
      healthPercentage: 33,
      runningContainers: 1,
      dockerGroups: 1
    });
    expect(snapshot.changeLoad.map((entry) => entry.project.id)).toEqual(["dirty"]);
    expect(snapshot.recentProjects.map((project) => project.id)).toEqual(["healthy", "dirty"]);
  });

  it("uses safe zero values for an empty or unavailable workspace", () => {
    const snapshot = buildDashboardSnapshot([], [], {
      ok: false,
      containers: [],
      groups: [],
      checkedAt: "2026-07-20T10:00:00.000Z",
      error: "Docker unavailable"
    });

    expect(snapshot.healthPercentage).toBe(0);
    expect(snapshot.runningContainers).toBe(0);
    expect(snapshot.dockerGroups).toBe(0);
  });
});
