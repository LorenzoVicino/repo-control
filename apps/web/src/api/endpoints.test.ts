import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAppUpdateStatus, updateRepoControl } from "./app";
import {
  approveBrainTask,
  cancelBrainTaskPlanning,
  createBrainTask,
  createBrainTaskFromPlan,
  fetchBrainContext,
  fetchBrainTasks,
  planBrainTask,
  runBrainTask,
  updateBrainTask
} from "./brain";
import { fetchDockerComposeProject, fetchDockerContainers, fetchDockerServiceLogs, stopDockerContainers } from "./docker";
import {
  cancelTerminalCommand,
  fetchGitActivity,
  fetchGitDetails,
  fetchGitFileDiff,
  fetchProjects,
  fetchProjectSummary,
  runProjectAction,
  runTerminalCommand
} from "./projects";
import {
  cancelWorkflowRun,
  createWorkflow,
  deleteWorkflow,
  executeWorkflow,
  fetchWorkflowRun,
  fetchWorkflowRuns,
  fetchWorkflows,
  updateWorkflow
} from "./workflows";
import {
  fetchPreferences,
  pickWorkspaceFolder,
  setRootPath,
  updatePreferences
} from "./workspace";

const jsonResponse = (payload: unknown = {}) => ({
  ok: true,
  json: async () => payload
});

describe("API endpoint contracts", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(jsonResponse());
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it("uses the app, Docker and workspace endpoints with their expected methods", async () => {
    await updateRepoControl();
    await fetchAppUpdateStatus();
    await fetchDockerContainers();
    await stopDockerContainers(["one", "two"]);
    await setRootPath("/workspace");
    await fetchPreferences();
    await updatePreferences({ favoriteProjectIds: ["alpha"] });

    expect(fetchMock.mock.calls).toEqual([
      ["/api/app/update", { method: "POST" }],
      ["/api/app/update-status", undefined],
      ["/api/docker/containers", undefined],
      ["/api/docker/containers/stop", expect.objectContaining({ method: "POST", body: "{\"containerIds\":[\"one\",\"two\"]}" })],
      ["/api/root", expect.objectContaining({ method: "POST", body: "{\"root\":\"/workspace\"}" })],
      ["/api/preferences", undefined],
      ["/api/preferences", expect.objectContaining({ method: "PUT", body: "{\"favoriteProjectIds\":[\"alpha\"]}" })]
    ]);
  });

  it("normalizes all folder picker outcomes", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ cancelled: true }))
      .mockResolvedValueOnce(jsonResponse({ path: "/chosen" }))
      .mockResolvedValueOnce(jsonResponse({ path: 42 }));

    await expect(pickWorkspaceFolder("/start")).resolves.toBeNull();
    await expect(pickWorkspaceFolder("/start")).resolves.toBe("/chosen");
    await expect(pickWorkspaceFolder("/start")).rejects.toThrow("Folder picker returned no path");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/folder-picker",
      expect.objectContaining({ method: "POST", body: "{\"initialPath\":\"/start\"}" })
    );
  });

  it("covers repository reads, commands and action response normalization", async () => {
    await fetchProjects();
    await fetchProjectSummary("alpha");
    await fetchGitDetails("alpha");
    await fetchGitActivity("alpha", { offset: 20, limit: 10 });
    await fetchGitFileDiff("alpha", { path: "src/new file.ts", previousPath: "src/old.ts" }, true);
    await runTerminalCommand("alpha", "npm test");
    await cancelTerminalCommand("alpha");
    await fetchDockerComposeProject("alpha");
    await fetchDockerServiceLogs("alpha", "web", 100);

    fetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true,
      command: "git fetch",
      exitCode: 0,
      stdout: "done",
      stderr: "",
      output: "done",
      durationMs: 2
    }));
    await expect(runProjectAction("alpha", "git/fetch", "Fetch")).resolves.toMatchObject({ command: "git fetch" });

    fetchMock.mockResolvedValueOnce(jsonResponse({ accepted: true }));
    await expect(runProjectAction("alpha", "git/pull", "Pull", { remote: "origin" })).resolves.toEqual({
      ok: true,
      command: "Pull",
      exitCode: 0,
      stdout: "",
      stderr: "",
      output: "Requested",
      durationMs: 0
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/projects/alpha/git/activity?offset=20&limit=10", undefined);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/alpha/git/diff?path=src%2Fnew+file.ts&staged=true&previousPath=src%2Fold.ts",
      undefined
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/alpha/terminal/run",
      expect.objectContaining({ body: "{\"command\":\"npm test\"}" })
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/alpha/git/fetch", { method: "POST" });
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/alpha/terminal/cancel", { method: "POST" });
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/alpha/docker/compose", undefined);
    expect(fetchMock).toHaveBeenCalledWith("/api/projects/alpha/docker/logs?service=web&tail=100", undefined);
  });

  it("covers every workflow endpoint and both execution modes", async () => {
    const draft = { name: "Release", description: "Ship", active: true, nodes: [], edges: [] };
    await fetchWorkflows();
    await createWorkflow(draft);
    await updateWorkflow("workflow-1", draft);
    await deleteWorkflow("workflow-1");
    await executeWorkflow("workflow-1", "run");
    await executeWorkflow("workflow-1", "dry-run", { branch: "main" });
    await fetchWorkflowRuns();
    await fetchWorkflowRuns("workflow-1");
    await fetchWorkflowRun("run-1");
    await cancelWorkflowRun("run-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workflows/workflow-1/run",
      expect.objectContaining({ method: "POST", body: "{\"inputs\":{}}" })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/workflows/workflow-1/dry-run",
      expect.objectContaining({ body: "{\"inputs\":{\"branch\":\"main\"}}" })
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/workflow-runs", undefined);
    expect(fetchMock).toHaveBeenCalledWith("/api/workflows/workflow-1/runs", undefined);
    expect(fetchMock).toHaveBeenCalledWith("/api/workflow-runs/run-1/cancel", { method: "POST" });
  });

  it("covers every task-engineering endpoint, including abortable planning", async () => {
    const controller = new AbortController();
    await fetchBrainTasks("alpha");
    await cancelBrainTaskPlanning("alpha", "request-1");
    await createBrainTask("alpha", {
      title: "Test",
      type: "feature",
      description: "Description",
      motivation: "Motivation"
    });
    await planBrainTask("alpha", {
      requestId: "request-1",
      brief: "Plan it",
      profile: "auto",
      language: "en"
    }, controller.signal);
    await createBrainTaskFromPlan("alpha", {
      title: "Test",
      type: "feature",
      profile: "lean",
      brief: "Plan it",
      description: "Description",
      motivation: "Motivation",
      requirements: "Requirements",
      design: "Design",
      breakdown: "Breakdown",
      checks: ["npm test"],
      assumptions: [],
      provider: "claude",
      generatedAt: "2026-08-03T00:00:00.000Z",
      sessionId: null,
      clarifications: [],
      language: "en"
    });
    await updateBrainTask("alpha", "task-1", { phase: "design", content: "New design" });
    await approveBrainTask("alpha", "task-1", "design");
    await fetchBrainContext("alpha", "task-1");
    await runBrainTask("alpha", "task-1", { prompt: "Implement", checks: ["npm test"] });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/alpha/tasks/plan",
      expect.objectContaining({ method: "POST", signal: controller.signal })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/alpha/tasks/task-1/approve",
      expect.objectContaining({ body: "{\"phase\":\"design\"}" })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/alpha/tasks/task-1/runs",
      expect.objectContaining({ body: "{\"prompt\":\"Implement\",\"checks\":[\"npm test\"]}" })
    );
  });
});
