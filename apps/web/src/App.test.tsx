import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { App } from "./App";
import {
  COLOR_PALETTE_OPTIONS,
  COLOR_PALETTE_STORAGE_KEY,
  createAppTheme,
  getInitialColorPalette
} from "./theme";

vi.mock("./components/dashboard/ProjectsDashboard", () => ({
  ProjectsDashboard: ({
    colorPalette,
    onColorPaletteChange
  }: {
    colorPalette: string;
    onColorPaletteChange: (value: "blue") => void;
  }) => (
    <button onClick={() => onColorPaletteChange("blue")}>
      palette-{colorPalette}
    </button>
  )
}));

describe("application theme bootstrap", () => {
  beforeEach(() => window.localStorage.clear());

  it("loads and persists the selected palette through the application shell", async () => {
    window.localStorage.setItem(COLOR_PALETTE_STORAGE_KEY, "red");
    const user = userEvent.setup();
    render(<App />);

    const paletteButton = screen.getByRole("button", { name: "palette-red" });
    await user.click(paletteButton);
    expect(screen.getByRole("button", { name: "palette-blue" })).toBeVisible();
    expect(window.localStorage.getItem(COLOR_PALETTE_STORAGE_KEY)).toBe("blue");
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
  });
});
