import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAgentStatus } from "../../api/agent";
import { createProjectFixture } from "../../test/projectFixture";
import { renderWithProviders } from "../../test/render";
import { AssistantPage } from "./AssistantPage";
import { createConversationStore } from "./conversationStore";
import { createFakeAgentApi } from "../../test/fakeAgentApi";

vi.mock("../../api/agent", () => ({
  fetchAgentStatus: vi.fn(),
  startAgentRun: vi.fn(),
  subscribeToAgentRun: vi.fn(),
  decideAgentApproval: vi.fn(),
  cancelAgentRun: vi.fn()
}));

const projects = [
  createProjectFixture("atlas-api", { isClean: false, modified: 2 }),
  createProjectFixture("docs", { behind: 1 })
];

function setup() {
  const fake = createFakeAgentApi();
  const store = createConversationStore(fake.api);
  const user = userEvent.setup();
  renderWithProviders(<AssistantPage projects={projects} workspaceRoot="/home/alex/projects" store={store} />);
  return { fake, store, user };
}

describe("AssistantPage", () => {
  beforeEach(() => {
    vi.mocked(fetchAgentStatus).mockResolvedValue({ available: true, command: "claude", model: "sonnet" });
  });

  it("opens on the agent home with suggestions from the workspace", async () => {
    setup();
    expect(screen.getByRole("heading", { name: "What should we do in your workspace?" })).toBeVisible();
    expect(screen.getByTitle("/home/alex/projects")).toHaveTextContent("…/alex/projects2 repositories");
    expect(await screen.findByText("Claude Code · headless · sonnet")).toBeVisible();
    expect(screen.getByRole("button", { name: /What needs me today\?/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Pull docs/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Review atlas-api/ })).toBeVisible();
  });

  it("streams a conversation with tool activity, an approval and a summary", async () => {
    const { fake, user } = setup();
    const composer = await screen.findByRole("textbox", { name: "Message the agent" });
    await waitFor(() => expect(composer).toBeEnabled());
    await user.type(composer, "Commit atlas-api{Enter}");

    expect(await screen.findByText("Commit atlas-api")).toBeVisible();
    expect(fake.calls.start).toEqual([{ prompt: "Commit atlas-api", sessionId: null }]);
    expect(screen.getByRole("button", { name: "Stop" })).toBeVisible();

    fake.emit(
      { type: "session", sessionId: "6d1f0c8e-6b3b-4c55-9d43-1f4f3c2b9a10", model: "sonnet", tools: [] },
      { type: "tool_call", toolUseId: "t-1", name: "git_diff", input: { repository: "atlas-api" } },
      { type: "tool_result", toolUseId: "t-1", isError: false, text: "atlas-api\nStaged:\n  none" },
      { type: "text_delta", text: "Two files **changed**" }
    );
    expect(await screen.findByText("Used 1 tool")).toBeVisible();
    expect(screen.getByText("changed").tagName).toBe("STRONG");

    fake.emit(
      { type: "text", text: "Two files **changed**. Committing." },
      { type: "tool_call", toolUseId: "t-2", name: "git_commit", input: { repository: "atlas-api", message: "Fix" } },
      { type: "approval_request", approvalId: "a-1", toolName: "git_commit", title: "Commit", input: { repository: "atlas-api", message: "Fix" } }
    );
    const card = (await screen.findByRole("heading", { name: "Approve this change?" })).closest("section")!;
    expect(within(card).getByText("Fix")).toBeVisible();
    await user.click(within(card).getByRole("button", { name: "Approve" }));
    expect(fake.calls.decisions).toEqual([{ runId: "run-1", approvalId: "a-1", behavior: "allow" }]);

    fake.emit(
      { type: "approval_resolved", approvalId: "a-1", behavior: "allow", reason: "user" },
      { type: "tool_result", toolUseId: "t-2", isError: false, text: "git commit in atlas-api succeeded." },
      { type: "text", text: "Committed `4d50376`." },
      { type: "result", ok: true, text: "Committed `4d50376`.", sessionId: "6d1f0c8e-6b3b-4c55-9d43-1f4f3c2b9a10", costUsd: 0.0123, durationMs: 4200, turns: 3 },
      { type: "status", status: "completed" }
    );
    fake.end();

    expect(await screen.findByRole("heading", { name: "Approved" })).toBeVisible();
    expect(screen.getByText("4d50376").tagName).toBe("CODE");
    expect(screen.getByText("Done in 4.2 s · 3 steps · 0.0123 USD")).toBeVisible();
    expect(screen.getByText("claude --resume 6d1f0c8e-6b3b-4c55-9d43-1f4f3c2b9a10")).toBeInTheDocument();
    expect(within(screen.getByRole("complementary", { name: "Conversation context" })).getByText("atlas-api")).toBeVisible();

    await user.type(screen.getByRole("textbox", { name: "Message the agent" }), "Now push it{Enter}");
    expect(fake.calls.start[1]).toEqual({ prompt: "Now push it", sessionId: "6d1f0c8e-6b3b-4c55-9d43-1f4f3c2b9a10" });
    await user.click(screen.getByRole("button", { name: "Stop" }));
    expect(fake.calls.cancelled).toEqual(["run-2"]);
    fake.emit({ type: "status", status: "cancelled" });
    expect(await screen.findByText("Stopped.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "New conversation" }));
    expect(screen.getByRole("heading", { name: "What should we do in your workspace?" })).toBeVisible();
  });

  it("starts from a suggestion and shows a denied approval", async () => {
    const { fake, user } = setup();
    const suggestion = await screen.findByRole("button", { name: /Pull docs/ });
    await waitFor(() => expect(suggestion).toBeEnabled());
    await user.click(suggestion);
    expect(fake.calls.start[0].prompt).toBe("Pull docs. Check first that its working tree is clean.");

    fake.emit({ type: "approval_request", approvalId: "a-2", toolName: "git_pull", title: "Pull (fast-forward only)", input: { repository: "docs" } });
    await user.click(await screen.findByRole("button", { name: "Deny" }));
    expect(fake.calls.decisions[0].behavior).toBe("deny");
    fake.emit({ type: "approval_resolved", approvalId: "a-2", behavior: "deny", reason: "user" });
    expect(await screen.findByRole("heading", { name: "Declined" })).toBeVisible();
  });

  it("explains when Claude Code is not available and disables the composer", async () => {
    vi.mocked(fetchAgentStatus).mockResolvedValue({ available: false, command: "claude", model: null });
    setup();
    expect(await screen.findByText("Claude Code is not available")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Message the agent" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /What needs me today\?/ })).toBeDisabled();
  });

  it("follows a streaming answer while the reader is at the bottom, and stops when they scroll up", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const { fake, user } = setup();
    const composer = await screen.findByRole("textbox", { name: "Message the agent" });
    await waitFor(() => expect(composer).toBeEnabled());
    await user.type(composer, "Status?{Enter}");
    await waitFor(() => expect(scrollTo).toHaveBeenCalled());

    // The reader scrolls up to reread: jsdom has no layout, so the page reports a tall document.
    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 5000 });
    window.dispatchEvent(new Event("scroll"));
    scrollTo.mockClear();
    fake.emit({ type: "text", text: "More output." });
    expect(await screen.findByText("More output.")).toBeVisible();
    expect(scrollTo).not.toHaveBeenCalled();

    Object.defineProperty(document.documentElement, "scrollHeight", { configurable: true, value: 0 });
    window.dispatchEvent(new Event("scroll"));
    fake.emit({ type: "text", text: "Even more." });
    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 0 }));
    scrollTo.mockRestore();
  });
});
