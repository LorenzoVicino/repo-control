import { screen } from "@testing-library/react";
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
      status: "Up",
      ports: "",
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
        dockerActionError="stop fallito"
        onRefreshDocker={onRefreshDocker}
        onStopDockerGroup={onStopDockerGroup}
      />
    );

    expect(screen.getByText("6 progetti")).toBeVisible();
    expect(screen.getByText("Altri 1 progetti")).toBeVisible();
    expect(screen.getByText("+1")).toBeVisible();
    expect(screen.getByText("/workspace/project-0")).toBeVisible();
    expect(screen.getByText("stop fallito")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Aggiorna container Docker" }));
    await user.click(screen.getByRole("button", { name: "Ferma compose project-0" }));
    expect(onRefreshDocker).toHaveBeenCalledOnce();
    expect(onStopDockerGroup).toHaveBeenCalledWith(groups[0]);
    expect(screen.getByRole("button", { name: "Ferma container project-1" })).toBeDisabled();
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
    expect(screen.getByText("lettura")).toBeVisible();
    expect(screen.getByText("Lettura container Docker")).toBeVisible();

    rerender(<ControlCenter {...props} isLoadingDocker={false} isRefreshingDocker={false} />);
    expect(screen.getByText("n/d")).toBeVisible();
    expect(screen.getByText("Nessun container avviato")).toBeVisible();

    rerender(<ControlCenter {...props} dockerStatus={{ ok: false, containers: [], groups: [], checkedAt: "", error: "daemon offline" }} isLoadingDocker={false} isRefreshingDocker={false} />);
    expect(screen.getByText("non disponibile")).toBeVisible();
    expect(screen.getByText("daemon offline")).toBeVisible();
  });
});
