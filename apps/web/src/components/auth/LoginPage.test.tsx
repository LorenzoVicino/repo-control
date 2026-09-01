import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchApiHealth, signIn } from "../../api/auth";
import { ApiError } from "../../api/http";
import { renderWithProviders } from "../../test/render";
import { AUTH_SESSION_QUERY_KEY } from "./authSession";
import { LoginPage } from "./LoginPage";

vi.mock("../../api/auth", () => ({
  fetchApiHealth: vi.fn(),
  fetchAuthSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn()
}));

const signInMock = vi.mocked(signIn);
const fetchApiHealthMock = vi.mocked(fetchApiHealth);

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchApiHealthMock.mockResolvedValue({ ok: true });
    signInMock.mockResolvedValue({ authRequired: true, authenticated: true, username: "owner" });
  });

  it("signs in with the submitted credentials and publishes the session", async () => {
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(<LoginPage />);

    expect(screen.getByRole("heading", { name: "Sign in to the workspace" })).toBeVisible();

    await user.type(screen.getByLabelText("Username"), "  owner  ");
    await user.type(screen.getByLabelText("Password"), "local-password");
    await user.click(screen.getByRole("checkbox", { name: "Remember me" }));
    await user.click(screen.getByRole("button", { name: /Sign in/ }));

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith({
        username: "owner",
        password: "local-password",
        remember: true
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(AUTH_SESSION_QUERY_KEY)).toEqual({
        authRequired: true,
        authenticated: true,
        username: "owner"
      });
    });
    // The password is dropped from component state once it has been exchanged for a session.
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("asks for both fields before calling the API", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText("Username"), "owner");
    await user.click(screen.getByRole("button", { name: /Sign in/ }));

    expect(await screen.findByText("Enter both a username and a password.")).toBeVisible();
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("translates the refusals the server reports by code", async () => {
    const user = userEvent.setup();
    signInMock.mockRejectedValue(
      new ApiError("Incorrect username or password.", 401, "INVALID_CREDENTIALS", null)
    );
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText("Username"), "owner");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: /Sign in/ }));

    expect(await screen.findByText("Incorrect username or password.")).toBeVisible();

    signInMock.mockRejectedValue(
      new ApiError("Too many failed attempts.", 429, "TOO_MANY_ATTEMPTS", { retryAfterSeconds: 12 })
    );
    await user.click(screen.getByRole("button", { name: /Sign in/ }));

    expect(
      await screen.findByText("Too many failed attempts. Try again in 12 seconds.")
    ).toBeVisible();
  });

  it("falls back to the server message for an unrecognized failure", async () => {
    const user = userEvent.setup();
    signInMock.mockRejectedValue(new Error("Failed to fetch"));
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText("Username"), "owner");
    await user.type(screen.getByLabelText("Password"), "local-password");
    await user.click(screen.getByRole("button", { name: /Sign in/ }));

    expect(await screen.findByText("Failed to fetch")).toBeVisible();
  });

  it("reveals the password and explains where the credentials come from", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const passwordField = screen.getByLabelText("Password");
    expect(passwordField).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");

    expect(screen.queryByText(/REPO_CONTROL_AUTH_USERNAME/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Forgotten credentials?" }));
    expect(await screen.findByText(/REPO_CONTROL_AUTH_USERNAME/)).toBeVisible();
  });

  it("reports whether the local API is answering at all", async () => {
    fetchApiHealthMock.mockRejectedValue(new Error("connection refused"));
    renderWithProviders(<LoginPage />);

    expect(await screen.findByText("Local API unreachable")).toBeVisible();
  });
});
