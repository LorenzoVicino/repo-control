import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../test/render";
import type {
  DockerContainerGroup,
  DockerContainersResponse,
  DockerContainerStats
} from "../../types/docker";
import { ControlCenter } from "./ControlCenter";

function createGroup(index: number, serviceCount = 1): DockerContainerGroup {
  return {
    id: `group-${index}`,
    name: `project-${index}`,
    composeProject: index === 0 ? "compose-project" : null,
    workingDir: index === 0 ? "/workspace/project-0" : null,
    containers: Array.from({ length: serviceCount }, (_, serviceIndex) => ({
      id: `container-${index}-${serviceIndex}`,
      name: `container-${serviceIndex}`,
      image: "image:latest",
      status: serviceIndex === 1 ? "Up 1 minute (unhealthy)" : "Up 1 minute (healthy)",
      ports: serviceIndex === 0 ? "0.0.0.0:3000->3000/tcp" : "",
      runningFor: "1 minute",
      composeProject: index === 0 ? "compose-project" : null,
      composeService: index === 0 ? `service-${serviceIndex}` : null,
      composeWorkingDir: index === 0 ? "/workspace/project-0" : null
    }))
  };
}

function createStats(containerId: string): DockerContainerStats {
  return {
    id: containerId,
    name: containerId,
    cpuPercent: 12.53,
    memoryUsedBytes: 134_217_728,
    memoryLimitBytes: 2_040_109_466,
    memoryPercent: 6.58,
    networkInBytes: 1_200,
    networkOutBytes: 640,
    blockReadBytes: 8_190_000,
    blockWriteBytes: 0,
    processCount: 17
  };
}

describe("ControlCenter", () => {
  it("renders groups, service overflow and Docker actions", async () => {
    const user = userEvent.setup();
    const groups = [createGroup(0, 5), ...Array.from({ length: 5 }, (_, index) => createGroup(index + 1))];
    const status: DockerContainersResponse = {
      ok: true,
      containers: groups.flatMap((group) => group.containers),
      groups,
      checkedAt: "2026-08-03T00:00:00.000Z",
      error: null
    };
    const onRefreshDocker = vi.fn();
    const onStopDockerGroup = vi.fn();
    const onOpenContainerConsole = vi.fn();

    renderWithTheme(
      <ControlCenter
        dockerStatus={status}
        containerStats={[createStats("container-0-0")]}
        isLoadingDocker={false}
        isRefreshingDocker={false}
        stoppingDockerGroupId="group-1"
        dockerActionError="stop failed"
        onRefreshDocker={onRefreshDocker}
        onStopDockerGroup={onStopDockerGroup}
        onOpenContainerConsole={onOpenContainerConsole}
      />
    );

    expect(screen.getByText("6 projects")).toBeVisible();
    expect(screen.getByRole("button", { name: "Show 1 more group" })).toBeVisible();
    expect(screen.getByText("service-4")).toBeVisible();
    expect(screen.getByRole("link", { name: /3000→3000\/tcp/ })).toHaveAttribute("href", "http://localhost:3000");
    expect(screen.getByText("Unhealthy")).toBeVisible();
    expect(screen.getByText("/workspace/project-0")).toBeVisible();
    expect(screen.getByText("stop failed")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Refresh Docker containers" }));
    await user.click(screen.getByRole("button", { name: "Stop compose project-0" }));
    expect(screen.getByText(/Other Docker groups are left untouched/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Stop 5 services" }));
    expect(onRefreshDocker).toHaveBeenCalledOnce();
    expect(onStopDockerGroup).toHaveBeenCalledWith(groups[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Stop container project-1" })).toBeDisabled();
  });

  it("shows resource usage per container and opens the console on the requested tab", async () => {
    const user = userEvent.setup();
    const group = createGroup(0, 2);
    const onOpenContainerConsole = vi.fn();

    renderWithTheme(
      <ControlCenter
        dockerStatus={{
          ok: true,
          containers: group.containers,
          groups: [group],
          checkedAt: "2026-08-03T00:00:00.000Z",
          error: null
        }}
        containerStats={[createStats("container-0-0")]}
        isLoadingDocker={false}
        isRefreshingDocker={false}
        stoppingDockerGroupId={null}
        dockerActionError={null}
        onRefreshDocker={vi.fn()}
        onStopDockerGroup={vi.fn()}
        onOpenContainerConsole={onOpenContainerConsole}
      />
    );

    expect(screen.getByText("CPU 12.5%")).toBeVisible();
    expect(screen.getByText("134 MB / 2.0 GB")).toBeVisible();
    // The second container has no sample in this response, so its cells stay empty rather
    // than borrowing the first container's numbers.
    expect(screen.getByText("CPU —")).toBeVisible();
    expect(screen.getByText("— / —")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Open a shell in container-0" }));
    expect(onOpenContainerConsole).toHaveBeenCalledWith(group.containers[0], "exec");

    await user.click(screen.getByRole("button", { name: "Follow the logs of container-1" }));
    expect(onOpenContainerConsole).toHaveBeenCalledWith(group.containers[1], "logs");
  });

  it("covers loading, empty and unavailable Docker states", () => {
    const props = {
      dockerStatus: undefined,
      containerStats: undefined,
      isLoadingDocker: true,
      isRefreshingDocker: true,
      stoppingDockerGroupId: null,
      dockerActionError: null,
      onRefreshDocker: vi.fn(),
      onStopDockerGroup: vi.fn(),
      onOpenContainerConsole: vi.fn()
    };
    const { rerender } = renderWithTheme(<ControlCenter {...props} />);
    expect(screen.getByText("reading")).toBeVisible();
    expect(screen.getByText("Reading Docker containers")).toBeVisible();

    rerender(<ControlCenter {...props} isLoadingDocker={false} isRefreshingDocker={false} />);
    expect(screen.getByText("n/a")).toBeVisible();
    expect(screen.getByText("No container running")).toBeVisible();

    rerender(<ControlCenter {...props} dockerStatus={{ ok: false, containers: [], groups: [], checkedAt: "", error: "daemon offline" }} isLoadingDocker={false} isRefreshingDocker={false} />);
    expect(screen.getByText("unavailable")).toBeVisible();
    expect(screen.getByText("daemon offline")).toBeVisible();
  });
});
