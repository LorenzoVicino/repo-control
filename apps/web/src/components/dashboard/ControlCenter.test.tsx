import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../test/render";
import type { DockerContainerGroup, DockerContainersResponse } from "../../types/docker";
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

    renderWithTheme(
      <ControlCenter
        dockerStatus={status}
        isLoadingDocker={false}
        isRefreshingDocker={false}
        stoppingDockerGroupId="group-1"
        dockerActionError="stop failed"
        onRefreshDocker={onRefreshDocker}
        onStopDockerGroup={onStopDockerGroup}
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

  it("covers loading, empty and unavailable Docker states", () => {
    const props = {
      dockerStatus: undefined,
      isLoadingDocker: true,
      isRefreshingDocker: true,
      stoppingDockerGroupId: null,
      dockerActionError: null,
      onRefreshDocker: vi.fn(),
      onStopDockerGroup: vi.fn()
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
