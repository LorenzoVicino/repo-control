import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../test/render";
import { createDemoProjects } from "../../demo/fixtures";
import { WorkspaceSetup } from "./WorkspaceSetup";

const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
function renderSetup(existing = false, completed = false, requested = false) {
  fetchMock.mockImplementation(async (_url, init) =>
    Response.json(
      init?.method === "PUT"
        ? { ok: true }
        : String(_url).endsWith("/tools")
          ? {
              tools: [
                {
                  id: "git",
                  label: "Git",
                  required: true,
                  status: "available",
                },
                {
                  id: "docker",
                  label: "Docker",
                  required: false,
                  status: "unreachable",
                },
              ],
            }
          : { existing, completed },
    ),
  );
  const props = {
    root: "C:\\Projects",
    projects: createDemoProjects(),
    scanning: false,
    onChangeRoot: vi.fn().mockResolvedValue(undefined),
    onOpenProject: vi.fn(),
    requested,
    onClose: vi.fn(),
  };
  renderWithTheme(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <WorkspaceSetup {...props} />
    </QueryClientProvider>,
  );
  return props;
}
it("confirms a typed Windows path, explains optional tools and opens the first repository", async () => {
  const user = userEvent.setup();
  const props = renderSetup();
  const input = await screen.findByRole("textbox", {
    name: "Workspace folder",
  });
  await user.clear(input);
  await user.type(input, "C:\\Users\\Alex Example\\Projects");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(props.onChangeRoot).toHaveBeenCalledWith(
    "C:\\Users\\Alex Example\\Projects",
  );
  expect(
    await screen.findByText("Installed · Docker daemon not reachable"),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Check again" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Open repository" }));
  await waitFor(() =>
    expect(props.onOpenProject).toHaveBeenCalledWith(props.projects[0].id),
  );
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/setup",
    expect.objectContaining({ method: "PUT", body: '{"version":1}' }),
  );
});
it("offers an invitation to existing users and persists skipping", async () => {
  const props = renderSetup(true);
  await userEvent.click(
    await screen.findByRole("button", { name: "Set up workspace" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Skip setup" }));
  await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  expect(props.onOpenProject).not.toHaveBeenCalled();
});
it("lets existing users dismiss the invitation accessibly", async () => {
  const props = renderSetup(true);
  await userEvent.click(await screen.findByRole("button", { name: "Close" }));
  await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  expect(screen.queryByText(/New here/)).not.toBeInTheDocument();
});
it("does not interrupt completed users but can be reopened", async () => {
  renderSetup(true, true, true);
  expect(await screen.findByRole("dialog")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  await userEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(
    screen.getByRole("textbox", { name: "Workspace folder" }),
  ).toBeVisible();
});
it("keeps the entered path and explains a failed scan", async () => {
  const props = renderSetup();
  props.onChangeRoot.mockRejectedValue(new Error("Folder does not exist"));
  await userEvent.click(
    await screen.findByRole("button", { name: "Scan folder" }),
  );
  expect(await screen.findByText("Folder does not exist")).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Workspace folder" })).toHaveValue(
    "C:\\Projects",
  );
});
