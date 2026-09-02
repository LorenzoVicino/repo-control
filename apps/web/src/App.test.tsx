import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { fetchAuthSession } from "./api/auth";
import {
  COLOR_PALETTE_OPTIONS,
  COLOR_PALETTE_STORAGE_KEY,
  createAppTheme,
  getInitialColorPalette
} from "./theme";

vi.mock("./api/auth", () => ({
  fetchApiHealth: vi.fn().mockResolvedValue({ ok: true }),
  fetchAuthSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn()
}));

// Stands in for the dashboard, and can make a request fail the way any real panel would
// when the session behind it has lapsed.
vi.mock("./components/dashboard/ProjectsDashboard", async () => {
  const { useQuery } = await import("@tanstack/react-query");
  const { ApiError } = await import("./api/http");

  return {
    ProjectsDashboard: ({
      colorPalette,
      onColorPaletteChange
    }: {
      colorPalette: string;
      onColorPaletteChange: (value: "blue") => void;
    }) => {
      const lapsingRequest = useQuery({
        queryKey: ["lapsing-panel"],
        queryFn: () => {
          throw new ApiError("Sign in to use the repo-control API.", 401, "UNAUTHENTICATED", null);
        },
        enabled: false,
        retry: false
      });

      return (
        <>
          <button onClick={() => onColorPaletteChange("blue")}>palette-{colorPalette}</button>
          <button onClick={() => void lapsingRequest.refetch()}>lapse-session</button>
        </>
      );
    }
  };
});

const fetchAuthSessionMock = vi.mocked(fetchAuthSession);

describe("application shell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    fetchAuthSessionMock.mockResolvedValue({
      authRequired: false,
      authenticated: true,
      username: null
    });
  });

  it("loads and persists the selected palette through the application shell", async () => {
    window.localStorage.setItem(COLOR_PALETTE_STORAGE_KEY, "red");
    const user = userEvent.setup();
    render(<App />);

    const paletteButton = await screen.findByRole("button", { name: "palette-red" });
    expect(document.body).toHaveStyle({ backgroundColor: createAppTheme("red").palette.background.default });
    await user.click(paletteButton);
    expect(screen.getByRole("button", { name: "palette-blue" })).toBeVisible();
    expect(document.body).toHaveStyle({ backgroundColor: createAppTheme("blue").palette.background.default });
    expect(window.localStorage.getItem(COLOR_PALETTE_STORAGE_KEY)).toBe("blue");
  });

  it("waits for the sign-in state before choosing a screen", async () => {
    fetchAuthSessionMock.mockReturnValue(new Promise(() => {}));
    render(<App />);

    expect(await screen.findByText("Loading repo-control…")).toBeVisible();
    expect(screen.queryByRole("button", { name: /palette-/ })).not.toBeInTheDocument();
  });

  it("shows the sign-in screen only while the API requires one", async () => {
    fetchAuthSessionMock.mockResolvedValue({
      authRequired: true,
      authenticated: false,
      username: null
    });
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in to the workspace" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /palette-/ })).not.toBeInTheDocument();
  });

  it("opens the workspace when the API reports an authenticated session", async () => {
    fetchAuthSessionMock.mockResolvedValue({
      authRequired: true,
      authenticated: true,
      username: "owner"
    });
    render(<App />);

    expect(await screen.findByRole("button", { name: /palette-/ })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Sign in to the workspace" })).not.toBeInTheDocument();
  });

  it("returns to the sign-in screen when any request reports a lapsed session", async () => {
    const user = userEvent.setup();
    fetchAuthSessionMock.mockResolvedValue({
      authRequired: true,
      authenticated: true,
      username: "owner"
    });
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "lapse-session" }));

    expect(await screen.findByRole("heading", { name: "Sign in to the workspace" })).toBeVisible();
  });

  it("opens the workspace when the sign-in state cannot be read at all", async () => {
    fetchAuthSessionMock.mockRejectedValue(new Error("connection refused"));
    render(<App />);

    // The API is the only thing that can enforce the gate, so an unreadable state must not
    // strand the owner on a sign-in screen no password can pass.
    expect(await screen.findByRole("button", { name: /palette-/ })).toBeVisible();
  });

  it("supports stored, legacy and operating-system palette preferences", () => {
    window.localStorage.setItem(COLOR_PALETTE_STORAGE_KEY, "green");
    expect(getInitialColorPalette()).toBe("green");

    window.localStorage.setItem(COLOR_PALETTE_STORAGE_KEY, "invalid");
    window.localStorage.setItem("repo-control-color-mode", "light");
    expect(getInitialColorPalette()).toBe("white");

    window.localStorage.setItem("repo-control-color-mode", "dark");
    expect(getInitialColorPalette()).toBe("black");

    window.localStorage.removeItem("repo-control-color-mode");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    expect(getInitialColorPalette()).toBe("black");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    expect(getInitialColorPalette()).toBe("white");
  });

  it("repaints browser autofill in every palette's own colors", () => {
    // Chrome's autofill background arrives through a UA rule marked !important, so the
    // fix has to be an inset shadow plus -webkit-text-fill-color. Without it an
    // autofilled field turns pale blue and stays that way on every dark palette.
    for (const option of COLOR_PALETTE_OPTIONS) {
      const theme = createAppTheme(option.id);
      const input = theme.components?.MuiOutlinedInput?.styleOverrides?.input as
        | Record<string, Record<string, string>>
        | undefined;
      const autofill = input?.[
        "&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus, &:-webkit-autofill:active"
      ];

      expect(autofill, option.id).toBeDefined();
      expect(autofill?.WebkitTextFillColor).toBe(theme.palette.text.primary);
      expect(autofill?.WebkitBoxShadow).toContain("inset");
      expect(autofill?.caretColor).toBe(theme.palette.text.primary);
    }
  });

  it("creates a usable theme for every advertised palette", () => {
    const themes = COLOR_PALETTE_OPTIONS.map((option) => createAppTheme(option.id));
    expect(themes.map((theme) => theme.palette.mode)).toEqual([
      "light",
      "dark",
      "dark",
      "dark",
      "dark"
    ]);
    expect(themes.every((theme) => theme.palette.primary.main.length > 0)).toBe(true);
    expect(new Set(themes.map((theme) => theme.palette.background.default)).size).toBe(themes.length);
    expect(new Set(themes.map((theme) => theme.palette.background.paper)).size).toBe(themes.length);
    expect(new Set(themes.map((theme) => theme.palette.secondary.main)).size).toBe(themes.length);
  });
});
