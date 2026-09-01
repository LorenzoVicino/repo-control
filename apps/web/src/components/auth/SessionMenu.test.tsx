import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAuthSession, signOut } from "../../api/auth";
import { renderWithProviders } from "../../test/render";
import type { AuthSession } from "../../types/auth";
import { AUTH_SESSION_QUERY_KEY, useAuthSession } from "./authSession";
import { SessionMenu } from "./SessionMenu";

// Mirrors how the application shell chooses a screen, which is the part sign-out has to
// move: dropping cached answers the wrong way detaches this reader from the session it is
// watching, and the menu stays on screen with the workspace still behind it.
function ShellUnderTest() {
  const { data: session } = useAuthSession();

  return session?.authenticated ? <SessionMenu /> : <p>sign-in screen</p>;
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

describe("SessionMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOutMock.mockResolvedValue({ authRequired: true, authenticated: false, username: null });
  });

  it("stays out of the way when the server requires no sign-in", async () => {
    fetchAuthSessionMock.mockResolvedValue({
      authRequired: false,
      authenticated: true,
      username: null
    });
    const { container } = renderWithProviders(<SessionMenu />);

    await waitFor(() => expect(fetchAuthSessionMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("names the signed-in user and ends the session on sign-out", async () => {
    const user = userEvent.setup();
    fetchAuthSessionMock.mockResolvedValue(SIGNED_IN);
    const { queryClient } = renderWithProviders(<SessionMenu />);

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
    const { queryClient } = renderWithProviders(<SessionMenu />);

    await user.click(await screen.findByRole("button", { name: "Session menu for owner" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(await screen.findByText("Unable to sign out")).toBeVisible();
    expect(queryClient.getQueryData(AUTH_SESSION_QUERY_KEY)).toEqual(SIGNED_IN);
  });
});
