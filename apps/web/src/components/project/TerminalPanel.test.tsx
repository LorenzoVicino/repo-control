import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandResult } from "../../types/common";
import { renderWithTheme } from "../../test/render";
import { TerminalPanel } from "./TerminalPanel";

const runTerminalCommand = vi.fn();
const cancelTerminalCommand = vi.fn();
const fetchTerminalSuggestions = vi.fn();

vi.mock("../../api/projects", () => ({
  runTerminalCommand: (...args: unknown[]) => runTerminalCommand(...args),
  cancelTerminalCommand: (...args: unknown[]) => cancelTerminalCommand(...args),
  fetchTerminalSuggestions: (...args: unknown[]) => fetchTerminalSuggestions(...args)
}));

function commandResult(overrides: Partial<CommandResult> = {}): CommandResult {
  return {
    ok: true,
    command: "pwd",
    exitCode: 0,
    stdout: "/workspace/alpha",
    stderr: "",
    output: "/workspace/alpha",
    durationMs: 12,
    ...overrides
  };
}

function renderTerminal(path = "/workspace/alpha", projectId = "alpha") {
  const callbacks = { onResult: vi.fn(), onCompleted: vi.fn() };
  const view = renderWithTheme(
    <TerminalPanel
      projectId={projectId}
      projectName="Alpha"
      projectPath={path}
      branch="main"
      hasDockerCompose
      composeServiceCount={3}
      {...callbacks}
    />
  );
  return { ...view, ...callbacks };
}

describe("TerminalPanel", () => {
  beforeEach(() => {
    runTerminalCommand.mockReset();
    cancelTerminalCommand.mockReset();
    cancelTerminalCommand.mockResolvedValue({ ok: true, cancelled: true });
    fetchTerminalSuggestions.mockReset();
    fetchTerminalSuggestions.mockResolvedValue({ suggestions: [] });
  });

  it("runs a trimmed command, renders output and reports completion", async () => {
    const user = userEvent.setup();
    const result = commandResult();
    runTerminalCommand.mockResolvedValue(result);
    const { onResult, onCompleted } = renderTerminal();

    const input = screen.getByPlaceholderText("type a command");
    await user.type(input, "  pwd  {enter}");

    await waitFor(() => expect(runTerminalCommand).toHaveBeenCalledWith("alpha", "pwd"));
    expect((await screen.findAllByText("/workspace/alpha")).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("exit 0")).toBeVisible();
    expect(screen.getByText("12ms")).toBeVisible();
    expect(onResult).toHaveBeenCalledWith(result);
    expect(onCompleted).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Interrompi comando" })).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it("runs from the button and renders successful empty output", async () => {
    const user = userEvent.setup();
    runTerminalCommand.mockResolvedValue(commandResult({ output: "", exitCode: null, durationMs: 0 }));
    renderTerminal("C:\\work\\repo-control");

    const input = screen.getByPlaceholderText("type a command");
    await user.type(input, "git status");
    await user.click(screen.getByRole("button", { name: "Run command" }));

    expect(await screen.findByText("Comando completato senza output.")).toBeVisible();
    expect(screen.getByText("done")).toBeVisible();
    expect(screen.getByText("0ms")).toBeVisible();
    expect(screen.getByTitle(".../work/repo-control")).toBeVisible();
  });

  it("keeps a pending command visible and prevents another execution", async () => {
    let resolveCommand!: (result: CommandResult) => void;
    runTerminalCommand.mockImplementation(() => new Promise<CommandResult>((resolve) => { resolveCommand = resolve; }));
    const { onCompleted } = renderTerminal();
    const input = screen.getByPlaceholderText("type a command");

    fireEvent.change(input, { target: { value: "npm test" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("running")).toBeVisible();
    expect(input).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Run command" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pulisci" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "npm run build" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(runTerminalCommand).toHaveBeenCalledOnce();

    resolveCommand(commandResult({ command: "npm test", output: "ok" }));
    expect(await screen.findByText("ok")).toBeVisible();
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it("cancels the active command from the terminal toolbar", async () => {
    let resolveCommand!: (result: CommandResult) => void;
    runTerminalCommand.mockImplementation(() => new Promise<CommandResult>((resolve) => { resolveCommand = resolve; }));
    cancelTerminalCommand.mockImplementation(async () => {
      resolveCommand(commandResult({ ok: false, exitCode: null, output: "Command cancelled" }));
      return { ok: true, cancelled: true };
    });
    const user = userEvent.setup();
    renderTerminal();

    await user.type(screen.getByPlaceholderText("type a command"), "npm test{enter}");
    await user.click(screen.getByRole("button", { name: "Interrompi comando" }));

    expect(cancelTerminalCommand).toHaveBeenCalledWith("alpha");
    expect(await screen.findByText("Command cancelled")).toBeVisible();
    expect(screen.getByText("interrotto")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Interrompi comando" })).not.toBeInTheDocument();
  });

  it("converts thrown errors into terminal results without completing", async () => {
    const user = userEvent.setup();
    runTerminalCommand.mockRejectedValueOnce(new Error("shell unavailable")).mockRejectedValueOnce("bad");
    const { onResult, onCompleted } = renderTerminal();
    const input = screen.getByPlaceholderText("type a command");

    await user.type(input, "first{enter}");
    expect(await screen.findByText("shell unavailable")).toBeVisible();
    expect(screen.getByText("failed")).toBeVisible();
    expect(screen.getByText("0ms")).toBeVisible();
    expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({ ok: false, output: "shell unavailable" }));

    await user.type(input, "second{enter}");
    expect(await screen.findByText("Command failed")).toBeVisible();
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it("navigates unique history and confirms transcript clearing", async () => {
    const user = userEvent.setup();
    runTerminalCommand.mockResolvedValue(commandResult({ output: "result" }));
    renderTerminal();
    const input = screen.getByPlaceholderText("type a command");

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveValue("");
    for (const command of ["one", "one", "two"]) {
      fireEvent.change(input, { target: { value: command } });
      fireEvent.keyDown(input, { key: "Enter" });
      await waitFor(() => expect(screen.getAllByText("result").length).toBeGreaterThan(0));
    }

    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveValue("two");
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveValue("one");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveValue("two");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveValue("");

    fireEvent.keyDown(input, { key: "l", ctrlKey: true });
    expect(screen.getByRole("dialog", { name: "Pulisci il transcript?" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Pulisci transcript" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Pulisci il transcript?" })).not.toBeInTheDocument());
    expect(screen.getByText(/repo-control terminal/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Pulisci" })).toBeDisabled();

    fireEvent.change(input, { target: { value: "three" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText("result");
    await user.click(screen.getByRole("button", { name: "Pulisci" }));
    await user.click(screen.getByRole("button", { name: "Pulisci transcript" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Pulisci il transcript?" })).not.toBeInTheDocument());
    expect(screen.getByText(/repo-control terminal/)).toBeVisible();
  });

  it("does not run blank or shift-enter input and supports short and Unix prompt paths", () => {
    const first = renderTerminal("/repo");
    const input = screen.getByPlaceholderText("type a command");
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "echo" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(runTerminalCommand).not.toHaveBeenCalled();
    expect(screen.getByText("/repo")).toBeVisible();
    expect(screen.getAllByTitle("/repo")).toHaveLength(2);

    first.unmount();
    renderTerminal("/home/user/projects/repo-control");
    expect(screen.getByTitle(".../projects/repo-control")).toBeVisible();
  });

  it("loads repository suggestions and applies one from the context rail", async () => {
    const user = userEvent.setup();
    fetchTerminalSuggestions.mockResolvedValue({ suggestions: ["npm run test", "npm run build"] });
    renderTerminal();

    await user.type(screen.getByLabelText("Comando terminale"), "npm");
    expect(await screen.findByRole("button", { name: "npm run test" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "npm run test" }));

    expect(screen.getByLabelText("Comando terminale")).toHaveValue("npm run test");
    expect(fetchTerminalSuggestions).toHaveBeenCalledWith("alpha", "npm");
  });

  it("copies the transcript and toggles long-line wrapping", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    runTerminalCommand.mockResolvedValue(commandResult({ output: "copied output" }));
    renderTerminal();

    await user.type(screen.getByLabelText("Comando terminale"), "pwd{enter}");
    await screen.findByText("copied output");
    await user.click(screen.getByRole("button", { name: "Copia tutto" }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("$ pwd\ncopied output\nexit 0 · 12ms"));
    expect(screen.getByRole("button", { name: "Copiato" })).toBeVisible();

    const wrapButton = screen.getByRole("button", { name: "A capo" });
    expect(wrapButton).toHaveAttribute("aria-pressed", "true");
    await user.click(wrapButton);
    expect(wrapButton).toHaveAttribute("aria-pressed", "false");
  });
});
