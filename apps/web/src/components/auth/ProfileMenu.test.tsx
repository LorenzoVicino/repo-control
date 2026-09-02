import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthSession, signOut } from "../../api/auth";
import { renderWithProviders } from "../../test/render";
import type { AuthSession } from "../../types/auth";
import { AUTH_SESSION_QUERY_KEY, useAuthSession } from "./authSession";
import { ProfileMenu } from "./ProfileMenu";

// Mirrors how the application shell chooses a screen, which is the part sign-out has to
// move: dropping cached answers the wrong way detaches this reader from the session it is
// watching, and the menu stays on screen with the workspace still behind it.
function ShellUnderTest() {
  const { data: session } = useAuthSession();

  return session?.authenticated ? renderMenu() : <p>sign-in screen</p>;
}

vi.mock("../../api/auth", () => ({
  fetchApiHealth: vi.fn(),
  fetchAuthSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn()
}));

const fetchAuthSessionMock = vi.mocked(fetchAuthSession);
const signOutMock = vi.mocked(signOut);

const SIGNED_IN: AuthSession = { authRequired: true, authenticated: true, username: "owner" };

const onColorPaletteChange = vi.fn();
const onOpenSettings = vi.fn();

function renderMenu(collapsed = false) {
  return (
    <ProfileMenu
      collapsed={collapsed}
      colorPalette="white"
      onColorPaletteChange={onColorPaletteChange}
      onOpenSettings={onOpenSettings}
    />
  );
}

describe("ProfileMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOutMock.mockResolvedValue({ authRequired: true, authenticated: false, username: null });
  });

  it("opens the settings section and the palettes without a session to sign out of", async () => {
    const user = userEvent.setup();
    fetchAuthSessionMock.mockResolvedValue({
      authRequired: false,
      authenticated: true,
      username: null
    });
    renderWithProviders(renderMenu());

    // A server with no credentials still has preferences to reach, so the tab stays put
    // and only the sign-out entry is withheld.
    const menuButton = await screen.findByRole("button", { name: "Profile menu" });
    await waitFor(() => expect(fetchAuthSessionMock).toHaveBeenCalled());
    await user.click(menuButton);

    expect(screen.getByText("Local mode")).toBeVisible();
    expect(screen.queryByRole("menuitem", { name: "Sign out" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Settings" }));
    expect(onOpenSettings).toHaveBeenCalledOnce();

    await user.click(menuButton);
    await user.click(screen.getByRole("menuitem", { name: /Select color palette/ }));
    await user.click(screen.getByRole("menuitemradio", { name: "Blue" }));
    expect(onColorPaletteChange).toHaveBeenCalledWith("blue");
  });

  it("returns from the palettes to the profile panel", async () => {
    const user = userEvent.setup();
    fetchAuthSessionMock.mockResolvedValue(SIGNED_IN);
    renderWithProviders(renderMenu());

    await user.click(await screen.findByRole("button", { name: "Session menu for owner" }));
    await user.click(screen.getByRole("menuitem", { name: /Select color palette/ }));
    expect(screen.getByRole("menuitemradio", { name: "White" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("menuitem", { name: "Interface appearance" }));
    expect(screen.getByRole("menuitem", { name: "Settings" })).toBeVisible();
    expect(screen.queryByRole("menuitemradio", { name: "White" })).not.toBeInTheDocument();
    expect(onColorPaletteChange).not.toHaveBeenCalled();
  });

  it("names the signed-in user and ends the session on sign-out", async () => {
    const user = userEvent.setup();
    fetchAuthSessionMock.mockResolvedValue(SIGNED_IN);
    const { queryClient } = renderWithProviders(renderMenu(true));

    const menuButton = await screen.findByRole("button", { name: "Session menu for owner" });
    expect(menuButton).toHaveTextContent("O");

    await user.click(menuButton);
    expect(screen.getByText("Signed in as")).toBeVisible();
    expect(screen.getByText("owner")).toBeVisible();

    // Cached workspace answers belong to the session being ended.
    queryClient.setQueryData(["projects"], { root: "/workspace", projects: [] });
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => expect(signOutMock).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(queryClient.getQueryData(AUTH_SESSION_QUERY_KEY)).toEqual({
        authRequired: true,
        authenticated: false,
        username: null
      });
    });
    expect(queryClient.getQueryData(["projects"])).toBeUndefined();
  });

  it("moves the shell to the sign-in screen when the session ends", async () => {
    const user = userEvent.setup();
    fetchAuthSessionMock.mockResolvedValue(SIGNED_IN);
    renderWithProviders(<ShellUnderTest />);

    await user.click(await screen.findByRole("button", { name: "Session menu for owner" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(await screen.findByText("sign-in screen")).toBeVisible();
  });

  it("keeps the session open and says so when sign-out fails", async () => {
    const user = userEvent.setup();
    fetchAuthSessionMock.mockResolvedValue(SIGNED_IN);
    signOutMock.mockRejectedValue(new Error("connection refused"));
    const { queryClient } = renderWithProviders(renderMenu());

    await user.click(await screen.findByRole("button", { name: "Session menu for owner" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(await screen.findByText("Unable to sign out")).toBeVisible();
    expect(queryClient.getQueryData(AUTH_SESSION_QUERY_KEY)).toEqual(SIGNED_IN);
  });
});
