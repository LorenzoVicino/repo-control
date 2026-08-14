import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../test/render";
import type { DockerComposeProjectResponse } from "../../types/docker";
import { DockerDetailPanel } from "./DockerDetailPanel";

const fetchDockerServiceLogs = vi.fn();

vi.mock("../../api/docker", () => ({
  fetchDockerServiceLogs: (...args: unknown[]) => fetchDockerServiceLogs(...args)
}));

vi.mock("../shared/ActionButton", () => ({
  ActionButton: ({ label, disabled }: { label: string; disabled?: boolean }) => <button type="button" disabled={disabled}>{label}</button>
}));

const compose: DockerComposeProjectResponse = {
  ok: true,
  name: "alpha",
  checkedAt: "2026-08-14T09:00:00.000Z",
  error: null,
  services: [
    {
      name: "web",
      containerId: "web-id",
      containerName: "alpha-web-1",
      image: "alpha:web",
      state: "running",
      status: "Up",
      health: "healthy",
      runningFor: "2 minutes",
      ports: [{ hostIp: "0.0.0.0", published: 5173, target: 3000, protocol: "tcp", url: "http://127.0.0.1:5173" }]
    },
    {
      name: "db",
      containerId: null,
      containerName: null,
      image: null,
      state: "stopped",
      status: "Not created",
      health: null,
      runningFor: null,
      ports: []
    }
  ]
};

describe("DockerDetailPanel", () => {
  beforeEach(() => {
    fetchDockerServiceLogs.mockReset();
    fetchDockerServiceLogs.mockImplementation(async (_projectId: string, service: string) => ({
      ok: true,
      command: "docker compose logs",
      exitCode: 0,
      stdout: `${service} ready`,
      stderr: "",
      output: `${service} ready`,
      durationMs: 2
    }));
  });

  it("shows all Compose services, clickable ports and service logs", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const user = userEvent.setup();
    renderWithTheme(
      <QueryClientProvider client={client}>
        <DockerDetailPanel projectId="alpha" compose={compose} isLoading={false} onResult={vi.fn()} onCompleted={vi.fn()} />
      </QueryClientProvider>
    );

    expect(screen.getByText("1/2 running")).toBeVisible();
    expect(screen.getByText("alpha-web-1")).toBeVisible();
    expect(screen.getByText("Container non creato")).toBeVisible();
    expect(screen.getByRole("link", { name: "5173:3000" })).toHaveAttribute("href", "http://127.0.0.1:5173");
    expect(await screen.findByText("web ready")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /^db / }));
    expect(await screen.findByText("db ready")).toBeVisible();
  });
});
