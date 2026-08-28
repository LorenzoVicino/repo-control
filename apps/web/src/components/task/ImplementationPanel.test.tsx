import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchBrainContext, runBrainTask } from "../../api/brain";
import { renderWithTheme } from "../../test/render";
import type { BrainTask, BrainTaskRun } from "../../types/brain";
import { ImplementationPanel } from "./ImplementationPanel";

vi.mock("../../api/brain", () => ({
  fetchBrainContext: vi.fn(),
  runBrainTask: vi.fn()
}));

function taskRun(status: BrainTaskRun["status"]): BrainTaskRun {
  return {
    id: `run-${status}`,
    status,
    prompt: "Implement",
    response: status === "succeeded" ? "Done" : "",
    error: status === "failed" ? "Tests failed" : null,
    claudeSessionId: null,
    specHash: "hash",
    checks: [
      { id: "check-1", command: "npm test", ok: status === "succeeded", exitCode: status === "succeeded" ? 0 : 1, output: "output", durationMs: 10 },
      { id: "check-2", command: "npm run build", ok: true, exitCode: 0, output: "output", durationMs: 20 }
    ],
    startedAt: "2026-08-03T00:00:00.000Z",
    completedAt: "2026-08-03T00:01:00.000Z"
  };
}

function task(overrides: Partial<BrainTask> = {}): BrainTask {
  return {
    id: "task-1",
    title: "Coverage",
    type: "feature",
    status: "implementation",
    contextRepositoryPaths: ["/workspace/beta"],
    definition: { description: "Description", motivation: "Motivation" },
    requirements: { content: "Requirements", approvedAt: null },
    design: { content: "Design", approvedAt: null },
    breakdown: { content: "Breakdown", approvedAt: null },
    verificationChecks: ["npm test", "npm run build"],
    planning: { profile: "full", provider: "claude", brief: "Brief", generatedAt: null, assumptions: [] },
    implementation: { log: [], runs: [taskRun("succeeded")] },
    decisions: [],
    git: { branch: null, prUrl: null },
    claudeSessionId: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    ...overrides
  };
}

function renderPanel(currentTask = task()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const onChanged = vi.fn().mockResolvedValue(undefined);
  const view = renderWithTheme(
    <QueryClientProvider client={queryClient}>
      <ImplementationPanel projectId="alpha" task={currentTask} onChanged={onChanged} />
    </QueryClientProvider>
  );
  return { ...view, onChanged };
}

describe("ImplementationPanel", () => {
  beforeEach(() => {
    vi.mocked(fetchBrainContext).mockResolvedValue({ content: "# Context pack", specHash: "hash", generatedAt: "2026-08-03T00:00:00.000Z" });
    vi.mocked(runBrainTask).mockResolvedValue(taskRun("succeeded"));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) }
    });
  });

  it("loads and copies context, normalizes checks and starts an iteration", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    const { onChanged } = renderPanel();
    expect(screen.getByText("Last run · Succeeded")).toBeVisible();
    expect(screen.getByText("2/2 checks")).toBeVisible();
    await user.click(screen.getByText("npm test"));
    expect(screen.getAllByText("Exit code: 0")[0]).toBeVisible();
    expect(screen.getAllByText("output")[0]).toBeVisible();
    fireEvent.click(screen.getByText("Context pack").closest("button")!);
    expect(await screen.findByText("# Context pack")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Copy context pack" }));
    expect(writeText).toHaveBeenCalledWith("# Context pack");

    fireEvent.change(screen.getByRole("textbox", { name: "Additional instruction" }), { target: { value: "Only safe changes" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Verification commands" }), { target: { value: " npm test \n\n npm run build " } });
    await user.click(screen.getByRole("button", { name: "Start iteration" }));
    await waitFor(() => expect(runBrainTask).toHaveBeenCalledWith("alpha", "task-1", {
      prompt: "Only safe changes",
      checks: ["npm test", "npm run build"]
    }));
    expect(onChanged).toHaveBeenCalled();
  });

  it("shows context, execution and failed-run errors and enforces task gates", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchBrainContext).mockRejectedValueOnce(new Error("context offline"));
    vi.mocked(runBrainTask).mockRejectedValueOnce("runner offline");
    const failed = task({ implementation: { log: [], runs: [taskRun("failed")] } });
    const view = renderPanel(failed);
    expect(screen.getByText("Last run · Failed")).toBeVisible();
    expect(screen.getByText("Tests failed")).toBeVisible();
    fireEvent.click(screen.getByText("Context pack").closest("button")!);
    expect(await screen.findByText("context offline")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Start iteration" }));
    expect(await screen.findByText("Operation failed")).toBeVisible();
    view.unmount();

    renderPanel(task({ status: "design", verificationChecks: [], implementation: { log: [], runs: [] } }));
    expect(screen.getByRole("button", { name: "Start iteration" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Verification commands" }), { target: { value: "" } });
    expect(screen.getByRole("button", { name: "Start iteration" })).toBeDisabled();
  });
});
