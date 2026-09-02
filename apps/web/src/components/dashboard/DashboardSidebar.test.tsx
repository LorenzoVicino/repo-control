import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/render";
import { DashboardSidebar } from "./DashboardSidebar";

// The footer carries the profile menu, which reads the session for itself.
vi.mock("../../api/auth", () => ({
  fetchApiHealth: vi.fn(),
  fetchAuthSession: vi.fn().mockResolvedValue({
    authRequired: false,
    authenticated: true,
    username: null
  }),
  signIn: vi.fn(),
  signOut: vi.fn()
}));

// An open menu marks the rest of the application aria-hidden, and MUI only restores it
// once the closing transition ends. Waiting for the menu to go keeps later role queries
// looking at the sidebar rather than at a screen still owned by the popover.
async function waitForMenuToClose() {
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
}

describe("DashboardSidebar", () => {
  it("navigates, changes palette and operates the workspace picker", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onToggleCollapsed = vi.fn();
    const onPickWorkspace = vi.fn();
    const onColorPaletteChange = vi.fn();

    renderWithProviders(
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

    await user.click(navigation.getByRole("button", { name: "Profile menu" }));
    await user.click(screen.getByRole("menuitem", { name: /Select color palette/ }));
    await user.click(screen.getByRole("menuitemradio", { name: "Blue" }));
    expect(onColorPaletteChange).toHaveBeenCalledWith("blue");
    await waitForMenuToClose();

    await user.click(navigation.getByRole("button", { name: "Profile menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Settings" }));
    expect(onNavigate).toHaveBeenCalledWith("settings");
    await waitForMenuToClose();
  });

  it("covers collapsed and mobile navigation states without exposing unavailable Docker", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onCloseMobile = vi.fn();
    const onPickWorkspace = vi.fn();
    const onColorPaletteChange = vi.fn();
    const { unmount } = renderWithProviders(
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
        rootError="invalid folder"
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
    expect(mobile.queryByText("Task engineering")).not.toBeInTheDocument();
    await user.click(mobile.getByRole("button", { name: /Repositories/ }));
    expect(onNavigate).toHaveBeenCalledWith("repositories");
    expect(onCloseMobile).toHaveBeenCalledOnce();
    const mobileProfileButton = mobile.getByRole("button", { name: "Profile menu" });
    await user.click(mobileProfileButton);
    expect(mobileProfileButton).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("menuitem", { name: /Select color palette/ }));
    await user.click(screen.getByRole("menuitemradio", { name: "Green" }));
    expect(onColorPaletteChange).toHaveBeenCalledWith("green");
    await waitForMenuToClose();

    unmount();
    const { unmount: unmountCollapsed } = renderWithProviders(
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

    unmountCollapsed();
    renderWithProviders(
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
