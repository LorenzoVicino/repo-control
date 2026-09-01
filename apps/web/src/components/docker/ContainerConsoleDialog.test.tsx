import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  closeContainerSession,
  openContainerExecSession,
  openContainerLogSession,
  readContainerSession,
  sendContainerSessionInput
} from "../../api/docker";
import { renderWithProviders } from "../../test/render";
import type { ContainerSession, DockerContainer } from "../../types/docker";
import { ContainerConsoleDialog } from "./ContainerConsoleDialog";

vi.mock("../../api/docker", () => ({
  closeContainerSession: vi.fn(),
  openContainerExecSession: vi.fn(),
  openContainerLogSession: vi.fn(),
  readContainerSession: vi.fn(),
  sendContainerSessionInput: vi.fn()
}));

const openExecMock = vi.mocked(openContainerExecSession);
const openLogsMock = vi.mocked(openContainerLogSession);
const readMock = vi.mocked(readContainerSession);
const sendMock = vi.mocked(sendContainerSessionInput);
const closeMock = vi.mocked(closeContainerSession);

const CONTAINER: DockerContainer = {
  id: "a1b2c3d4e5f6",
  name: "acme-web-1",
  image: "app:web",
  status: "Up 2 hours",
  ports: "0.0.0.0:3000->3000/tcp",
  runningFor: "2 hours",
  composeProject: "acme",
  composeService: "web",
  composeWorkingDir: "/workspace/acme"
};

function session(overrides: Partial<ContainerSession> = {}): ContainerSession {
  return {
    id: "session-one",
    kind: "exec",
    containerId: CONTAINER.id,
    containerName: CONTAINER.name,
    shell: "bash",
    command: `docker exec -i ${CONTAINER.id} bash`,
    createdAt: "2026-09-01T10:00:00.000Z",
    running: true,
    exitCode: null,
    cursor: 0,
    ...overrides
  };
}

function transcript(): HTMLElement {
  return screen.getByLabelText("Shell session output");
}

describe("ContainerConsoleDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openExecMock.mockResolvedValue(session());
    openLogsMock.mockResolvedValue(session({ id: "session-logs", kind: "logs", shell: null }));
    readMock.mockResolvedValue({ ...session(), cursor: 0, chunk: "", truncated: false });
    sendMock.mockResolvedValue({ ok: true });
    closeMock.mockResolvedValue({ ok: true });
  });

  it("opens a shell, streams its output and sends a command with a local echo", async () => {
    const user = userEvent.setup();
    readMock
      .mockResolvedValueOnce({ ...session(), cursor: 12, chunk: "bin etc home\n", truncated: false })
      .mockResolvedValue({ ...session(), cursor: 12, chunk: "", truncated: false });

    renderWithProviders(
      <ContainerConsoleDialog container={CONTAINER} initialKind="exec" onClose={vi.fn()} />
    );

    await waitFor(() => expect(openExecMock).toHaveBeenCalledWith(CONTAINER.id));
    expect(await screen.findByText(/shell ready · bash/)).toBeVisible();
    await waitFor(() => expect(transcript()).toHaveTextContent("bin etc home"));

    // The second read continues from the cursor the first one returned.
    await waitFor(() => expect(readMock).toHaveBeenCalledWith("session-one", 12));

    await user.type(screen.getByLabelText("Command to run inside the container"), "ls -la");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(sendMock).toHaveBeenCalledWith("session-one", "ls -la\n"));
    // Echoed locally, because a piped shell never echoes the command itself.
    expect(transcript()).toHaveTextContent("$ ls -la");
    expect(screen.getByLabelText("Command to run inside the container")).toHaveValue("");
  });

  it("recalls previous commands with the arrow keys", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ContainerConsoleDialog container={CONTAINER} initialKind="exec" onClose={vi.fn()} />
    );

    const input = await screen.findByLabelText("Command to run inside the container");
    await user.type(input, "pwd{Enter}");
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith("session-one", "pwd\n"));

    await user.type(input, "whoami{Enter}");
    await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(2));

    await user.click(input);
    await user.keyboard("{ArrowUp}");
    expect(input).toHaveValue("whoami");
    await user.keyboard("{ArrowUp}");
    expect(input).toHaveValue("pwd");
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveValue("whoami");
    await user.keyboard("{ArrowDown}");
    expect(input).toHaveValue("");
  });

  it("follows logs on the other tab and offers no way to type into them", async () => {
    const user = userEvent.setup();
    readMock.mockResolvedValue({
      ...session({ id: "session-logs", kind: "logs", shell: null }),
      cursor: 6,
      chunk: "ready\n",
      truncated: false
    });

    renderWithProviders(
      <ContainerConsoleDialog container={CONTAINER} initialKind="exec" onClose={vi.fn()} />
    );

    await waitFor(() => expect(openExecMock).toHaveBeenCalled());
    await user.click(screen.getByRole("tab", { name: "Logs" }));

    await waitFor(() => expect(openLogsMock).toHaveBeenCalledWith(CONTAINER.id));
    const logs = await screen.findByLabelText("Container log output");
    await waitFor(() => expect(logs).toHaveTextContent("ready"));
    expect(screen.getByText(/Following this container's output/)).toBeVisible();
    // The shell pane is still mounted behind the tab, so its command line must be hidden
    // rather than merely off screen: typing into it would run commands out of view.
    expect(screen.getByLabelText("Command to run inside the container")).not.toBeVisible();
    expect(transcript()).not.toBeVisible();

    // The shell stays open behind the logs tab, so its state is still there on return.
    expect(closeMock).not.toHaveBeenCalled();
  });

  it("reports an ended session and stops accepting commands", async () => {
    readMock.mockResolvedValue({
      ...session({ running: false, exitCode: 137 }),
      cursor: 5,
      chunk: "bye\n",
      truncated: false
    });

    renderWithProviders(
      <ContainerConsoleDialog container={CONTAINER} initialKind="exec" onClose={vi.fn()} />
    );

    expect(await screen.findByText(/session ended · exit 137/)).toBeVisible();
    expect(screen.getByLabelText("Command to run inside the container")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run the command" })).toBeDisabled();
  });

  it("says when output has scrolled out of the retained window", async () => {
    readMock.mockResolvedValue({ ...session(), cursor: 400, chunk: "tail\n", truncated: true });

    renderWithProviders(
      <ContainerConsoleDialog container={CONTAINER} initialKind="exec" onClose={vi.fn()} />
    );

    expect(
      await screen.findByText(/Older output has scrolled out of the window kept by the server/)
    ).toBeVisible();
  });

  it("surfaces a refused session instead of an empty console", async () => {
    openExecMock.mockRejectedValue(new Error("This container has no usable shell"));

    renderWithProviders(
      <ContainerConsoleDialog container={CONTAINER} initialKind="exec" onClose={vi.fn()} />
    );

    expect(await screen.findByText("This container has no usable shell")).toBeVisible();
    expect(readMock).not.toHaveBeenCalled();
  });

  it("closes the session it opened when the dialog goes away", async () => {
    const { rerender } = renderWithProviders(
      <ContainerConsoleDialog container={CONTAINER} initialKind="exec" onClose={vi.fn()} />
    );

    await waitFor(() => expect(openExecMock).toHaveBeenCalled());

    rerender(<ContainerConsoleDialog container={null} initialKind="exec" onClose={vi.fn()} />);

    await waitFor(() => expect(closeMock).toHaveBeenCalledWith("session-one"));
  });

  it("clears the view and restarts the session on request", async () => {
    const user = userEvent.setup();
    readMock
      .mockResolvedValueOnce({ ...session(), cursor: 7, chunk: "listed-file\n", truncated: false })
      .mockResolvedValue({ ...session(), cursor: 7, chunk: "", truncated: false });

    renderWithProviders(
      <ContainerConsoleDialog container={CONTAINER} initialKind="exec" onClose={vi.fn()} />
    );

    await waitFor(() => expect(transcript()).toHaveTextContent("listed-file"));

    await user.click(screen.getAllByRole("button", { name: "Clear the view" })[0]);
    await waitFor(() => expect(transcript()).not.toHaveTextContent("listed-file"));
    expect(transcript()).toHaveTextContent("No output yet.");

    await user.click(screen.getAllByRole("button", { name: "Restart the session" })[0]);
    await waitFor(() => expect(closeMock).toHaveBeenCalledWith("session-one"));
    await waitFor(() => expect(openExecMock).toHaveBeenCalledTimes(2));
  });
});
