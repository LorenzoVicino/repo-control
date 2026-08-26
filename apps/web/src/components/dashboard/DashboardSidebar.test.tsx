import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../test/render";
import { DashboardSidebar } from "./DashboardSidebar";

describe("DashboardSidebar", () => {
  it("navigates, changes palette and operates the workspace picker", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onToggleCollapsed = vi.fn();
    const onPickWorkspace = vi.fn();
    const onColorPaletteChange = vi.fn();

    renderWithTheme(
      <DashboardSidebar
        activeSection="overview"
        collapsed={false}
        mobileOpen={false}
        colorPalette="white"
        repositoryCount={4}
        favoriteCount={2}
        dockerCount={1}
        dockerAvailable
        workspaceRoot="/workspace"
        rootError={null}
        isPickingRoot={false}
        onNavigate={onNavigate}
        onToggleCollapsed={onToggleCollapsed}
        onCloseMobile={vi.fn()}
        onPickWorkspace={onPickWorkspace}
        onColorPaletteChange={onColorPaletteChange}
      />
    );

    const navigation = within(screen.getByLabelText("Dashboard navigation"));
    expect(navigation.getByTestId("repo-control-logo")).toHaveAttribute(
      "src",
      "/icon/repo-control-icon-medium.svg"
    );
    expect(navigation.getByText("4")).toBeVisible();
    expect(navigation.getByText("2")).toBeVisible();
    expect(navigation.getByText("1")).toBeVisible();
    await user.click(navigation.getByRole("button", { name: /Docker/ }));
    expect(onNavigate).toHaveBeenCalledWith("docker");

    await user.click(navigation.getByRole("button", { name: "Collapse sidebar" }));
    expect(onToggleCollapsed).toHaveBeenCalledOnce();
    await user.click(navigation.getByRole("button", { name: /Change workspace/ }));
    expect(onPickWorkspace).toHaveBeenCalledOnce();

    await user.click(navigation.getByRole("button", { name: /Select color palette/ }));
    await user.click(screen.getByRole("menuitemradio", { name: "Blue" }));
    expect(onColorPaletteChange).toHaveBeenCalledWith("blue");
  });

  it("covers collapsed and mobile navigation states without exposing unavailable Docker", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onCloseMobile = vi.fn();
    const onPickWorkspace = vi.fn();
    const onColorPaletteChange = vi.fn();
    const { rerender } = renderWithTheme(
      <DashboardSidebar
        activeSection="favorites"
        collapsed
        mobileOpen
        colorPalette="black"
        repositoryCount={0}
        favoriteCount={0}
        dockerCount={0}
        dockerAvailable={false}
        workspaceRoot=""
        rootError="cartella non valida"
        isPickingRoot
        onNavigate={onNavigate}
        onToggleCollapsed={vi.fn()}
        onCloseMobile={onCloseMobile}
        onPickWorkspace={onPickWorkspace}
        onColorPaletteChange={onColorPaletteChange}
      />
    );

    const mobile = within(screen.getByLabelText("Mobile dashboard navigation"));
    expect(mobile.queryByText("Docker")).not.toBeInTheDocument();
    await user.click(mobile.getByRole("button", { name: /Repositories/ }));
    expect(onNavigate).toHaveBeenCalledWith("repositories");
    expect(onCloseMobile).toHaveBeenCalledOnce();
    const mobilePaletteButton = mobile.getByRole("button", { name: /Select color palette/ });
    await user.click(mobilePaletteButton);
    expect(mobilePaletteButton).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("menuitemradio", { name: "Green" }));
    expect(onColorPaletteChange).toHaveBeenCalledWith("green");

    rerender(
      <DashboardSidebar
        activeSection="repositories"
        collapsed
        mobileOpen={false}
        colorPalette="black"
        repositoryCount={0}
        favoriteCount={0}
        dockerCount={0}
        dockerAvailable={false}
        workspaceRoot="/workspace"
        rootError={null}
        isPickingRoot
        onNavigate={onNavigate}
        onToggleCollapsed={vi.fn()}
        onCloseMobile={onCloseMobile}
        onPickWorkspace={onPickWorkspace}
        onColorPaletteChange={vi.fn()}
      />
    );
    const desktop = within(screen.getByLabelText("Dashboard navigation"));
    expect(desktop.queryByText("Docker")).not.toBeInTheDocument();
    expect(desktop.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    expect(desktop.getByRole("button", { name: /Opening folder picker/ })).toBeDisabled();

    rerender(
      <DashboardSidebar
        activeSection="repositories"
        collapsed
        mobileOpen={false}
        colorPalette="black"
        repositoryCount={0}
        favoriteCount={0}
        dockerCount={0}
        dockerAvailable={false}
        workspaceRoot="/workspace"
        rootError={null}
        isPickingRoot={false}
        onNavigate={onNavigate}
        onToggleCollapsed={vi.fn()}
        onCloseMobile={onCloseMobile}
        onPickWorkspace={onPickWorkspace}
        onColorPaletteChange={vi.fn()}
      />
    );
    await user.click(within(screen.getByLabelText("Dashboard navigation")).getByRole("button", {
      name: /Change workspace/
    }));
    expect(onPickWorkspace).toHaveBeenCalledOnce();
  });
});
