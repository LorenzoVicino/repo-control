import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../test/render";
import type { AppUpdateStatus } from "../../types/app";
import { DashboardAppBar } from "./DashboardAppBar";

const AVAILABLE_UPDATE: AppUpdateStatus = {
  currentVersion: "0.5.0",
  latestVersion: "0.6.0",
  updateAvailable: true,
  checkedAt: "2026-08-03T00:00:00.000Z",
  error: null
};

describe("DashboardAppBar", () => {
  it("drives search, navigation, update and repository controls", async () => {
    const user = userEvent.setup();
    const handlers = {
      onOpenMobileNavigation: vi.fn(),
      onOpenSearch: vi.fn(),
      onUpdateApp: vi.fn(),
      onViewModeChange: vi.fn(),
      onRefreshProjects: vi.fn()
    };
    renderWithTheme(
      <DashboardAppBar
        activeSection="repositories"
        activeProjectName={null}
        search="alpha"
        viewMode="map"
        appUpdateStatus={AVAILABLE_UPDATE}
        appUpdateStatusError={null}
        isCheckingAppUpdate={false}
        isLoadingAppUpdateStatus={false}
        isUpdatingApp={false}
        isFetchingProjects={false}
        {...handlers}
      />
    );

    await user.click(screen.getByRole("button", { name: "Apri navigazione" }));
    await user.click(screen.getByRole("textbox", { name: /Apri ricerca repository/ }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: /Apri ricerca repository/ }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("textbox", { name: /Apri ricerca repository/ }), { key: " " });
    expect(handlers.onOpenMobileNavigation).toHaveBeenCalledOnce();
    expect(handlers.onOpenSearch).toHaveBeenCalledTimes(3);

    await user.click(screen.getByRole("button", { name: /Aggiorna repo-control alla versione 0.6.0/ }));
    await user.click(screen.getByRole("button", { name: "Vista tabella" }));
    await user.click(screen.getByRole("button", { name: "Griglia repository" }));
    await user.click(screen.getByRole("button", { name: "Aggiorna repository" }));
    expect(handlers.onUpdateApp).toHaveBeenCalledOnce();
    expect(handlers.onViewModeChange).toHaveBeenCalledWith("table");
    expect(handlers.onRefreshProjects).toHaveBeenCalledOnce();
  });

  it("renders every update status and active-project branch", () => {
    const baseProps = {
      activeSection: "overview" as const,
      activeProjectName: "alpha",
      search: "",
      viewMode: "table" as const,
      appUpdateStatus: undefined,
      appUpdateStatusError: null as unknown,
      isCheckingAppUpdate: true,
      isLoadingAppUpdateStatus: true,
      isUpdatingApp: false,
      isFetchingProjects: true,
      onOpenMobileNavigation: vi.fn(),
      onOpenSearch: vi.fn(),
      onUpdateApp: vi.fn(),
      onViewModeChange: vi.fn(),
      onRefreshProjects: vi.fn()
    };
    const { rerender } = renderWithTheme(<DashboardAppBar {...baseProps} />);
    expect(screen.getByText("alpha")).toBeVisible();
    expect(screen.getByRole("button", { name: "Aggiorna repo-control" })).toBeDisabled();

    rerender(<DashboardAppBar {...baseProps} appUpdateStatus={{ ...AVAILABLE_UPDATE, updateAvailable: false, error: "offline" }} isCheckingAppUpdate={false} isLoadingAppUpdateStatus={false} />);
    expect(screen.getByRole("button", { name: "Aggiorna repo-control" })).toBeDisabled();

    rerender(<DashboardAppBar {...baseProps} appUpdateStatus={undefined} appUpdateStatusError={new Error("rete")} isCheckingAppUpdate={false} isLoadingAppUpdateStatus={false} />);
    expect(screen.getByRole("button", { name: "Aggiorna repo-control" })).toBeDisabled();

    rerender(<DashboardAppBar {...baseProps} appUpdateStatus={AVAILABLE_UPDATE} isUpdatingApp isCheckingAppUpdate={false} isLoadingAppUpdateStatus={false} />);
    expect(screen.getByRole("button", { name: "Aggiorna repo-control" })).toBeDisabled();

    rerender(<DashboardAppBar {...baseProps} appUpdateStatus={{ ...AVAILABLE_UPDATE, updateAvailable: false, latestVersion: null }} appUpdateStatusError={null} isUpdatingApp={false} isCheckingAppUpdate={false} isLoadingAppUpdateStatus={false} />);
    expect(screen.getByRole("button", { name: "Aggiorna repo-control" })).toBeDisabled();
  });
});
