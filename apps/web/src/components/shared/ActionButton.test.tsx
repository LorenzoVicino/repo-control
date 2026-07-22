import LaunchIcon from "@mui/icons-material/Launch";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runProjectAction } from "../../api/projects";
import { renderWithTheme } from "../../test/render";
import type { CommandResult } from "../../types/common";
import { ActionButton } from "./ActionButton";

vi.mock("../../api/projects", () => ({
  runProjectAction: vi.fn()
}));

const runProjectActionMock = vi.mocked(runProjectAction);

describe("ActionButton", () => {
  beforeEach(() => {
    runProjectActionMock.mockReset();
  });

  it("disables duplicate execution and reports a successful result", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    const onCompleted = vi.fn();
    const result: CommandResult = {
      ok: true,
      command: "git fetch",
      exitCode: 0,
      stdout: "done",
      stderr: "",
      output: "done",
      durationMs: 12
    };
    let resolveAction: (value: CommandResult) => void = () => undefined;
    runProjectActionMock.mockReturnValue(new Promise((resolve) => {
      resolveAction = resolve;
    }));

    renderWithTheme(
      <ActionButton
        projectId="project-1"
        actionPath="git/fetch"
        label="Fetch"
        icon={<LaunchIcon />}
        onResult={onResult}
        onCompleted={onCompleted}
      />
    );

    const button = screen.getByRole("button", { name: "Fetch" });
    await user.click(button);
    expect(button).toBeDisabled();
    expect(runProjectActionMock).toHaveBeenCalledWith("project-1", "git/fetch", "Fetch", undefined);

    await act(async () => resolveAction(result));

    await waitFor(() => expect(button).toBeEnabled());
    expect(onResult).toHaveBeenCalledWith(result);
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it("converts rejected actions into a renderable command result", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    runProjectActionMock.mockRejectedValue(new Error("network unavailable"));

    renderWithTheme(
      <ActionButton
        projectId="project-1"
        actionPath="git/fetch"
        label="Fetch"
        icon={<LaunchIcon />}
        onResult={onResult}
      />
    );

    await user.click(screen.getByRole("button", { name: "Fetch" }));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(expect.objectContaining({
      ok: false,
      command: "Fetch",
      stderr: "network unavailable"
    })));
  });
});
