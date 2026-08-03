import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommandResult } from "../../types/common";
import { renderWithTheme } from "../../test/render";
import { TerminalPanel } from "./TerminalPanel";

const runTerminalCommand = vi.fn();

vi.mock("../../api/projects", () => ({
  runTerminalCommand: (...args: unknown[]) => runTerminalCommand(...args)
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
    <TerminalPanel projectId={projectId} projectName="Alpha" projectPath={path} {...callbacks} />
  );
  return { ...view, ...callbacks };
}

describe("TerminalPanel", () => {
  beforeEach(() => {
    runTerminalCommand.mockReset();
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
    expect(screen.getByText("exit 0 - 12ms")).toBeVisible();
    expect(onResult).toHaveBeenCalledWith(result);
    expect(onCompleted).toHaveBeenCalledOnce();
    expect(screen.getByText("ready")).toBeVisible();
    expect(input).toHaveFocus();
  });

  it("runs from the icon and renders successful empty output", async () => {
    const user = userEvent.setup();
    runTerminalCommand.mockResolvedValue(commandResult({ output: "", exitCode: null, durationMs: 0 }));
    renderTerminal("C:\\work\\repo-control");

    const input = screen.getByPlaceholderText("type a command");
    await user.type(input, "git status");
    await user.click(screen.getByRole("button", { name: "Run command" }));

    expect(await screen.findByText("done")).toBeVisible();
    expect(screen.getByText("exit n/a - 0ms")).toBeVisible();
    expect(screen.getByText(".../work/repo-control")).toBeVisible();
  });

  it("keeps a pending command visible and prevents another execution", async () => {
    let resolveCommand!: (result: CommandResult) => void;
    runTerminalCommand.mockImplementation(() => new Promise<CommandResult>((resolve) => { resolveCommand = resolve; }));
    const { onCompleted } = renderTerminal();
    const input = screen.getByPlaceholderText("type a command");

    fireEvent.change(input, { target: { value: "npm test" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getAllByText("running")).toHaveLength(2);
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run command" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Run command" }));
    expect(runTerminalCommand).toHaveBeenCalledOnce();

    resolveCommand(commandResult({ command: "npm test", output: "ok" }));
    expect(await screen.findByText("ok")).toBeVisible();
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it("converts thrown errors into terminal results without completing", async () => {
    const user = userEvent.setup();
    runTerminalCommand.mockRejectedValueOnce(new Error("shell unavailable")).mockRejectedValueOnce("bad");
    const { onResult, onCompleted } = renderTerminal();
    const input = screen.getByPlaceholderText("type a command");

    await user.type(input, "first{enter}");
    expect(await screen.findByText("shell unavailable")).toBeVisible();
    expect(screen.getByText("exit n/a - 0ms")).toBeVisible();
    expect(onResult).toHaveBeenLastCalledWith(expect.objectContaining({ ok: false, output: "shell unavailable" }));

    await user.type(input, "second{enter}");
    expect(await screen.findByText("Command failed")).toBeVisible();
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it("navigates unique command history and clears entries from keyboard and button", async () => {
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
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveValue("one");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveValue("two");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveValue("");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveValue("");

    fireEvent.keyDown(input, { key: "l", ctrlKey: true });
    expect(screen.getByText("repo-control terminal")).toBeVisible();
    expect(screen.getByRole("button", { name: "Clear terminal" })).toBeDisabled();

    fireEvent.change(input, { target: { value: "three" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText("result");
    await user.click(screen.getByRole("button", { name: "Clear terminal" }));
    expect(screen.getByText("repo-control terminal")).toBeVisible();
  });

  it("does not run blank or shift-enter input and supports short and Unix prompt paths", () => {
    const first = renderTerminal("/repo");
    const input = screen.getByPlaceholderText("type a command");
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "echo" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(runTerminalCommand).not.toHaveBeenCalled();
    expect(screen.getAllByText("/repo")).toHaveLength(2);

    first.unmount();
    renderTerminal("/home/user/projects/repo-control");
    expect(screen.getByText(".../projects/repo-control")).toBeVisible();
  });
});
