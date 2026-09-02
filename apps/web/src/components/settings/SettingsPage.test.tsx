import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n, { LANGUAGE_STORAGE_KEY } from "../../i18n";
import { renderWithTheme } from "../../test/render";
import type { ColorPalette, FontScale } from "../../types/common";
import { SettingsPage } from "./SettingsPage";

function renderSettings(overrides: {
  colorPalette?: ColorPalette;
  fontScale?: FontScale;
} = {}) {
  const onColorPaletteChange = vi.fn();
  const onFontScaleChange = vi.fn();

  return {
    onColorPaletteChange,
    onFontScaleChange,
    ...renderWithTheme(
      <SettingsPage
        colorPalette={overrides.colorPalette ?? "white"}
        fontScale={overrides.fontScale ?? "medium"}
        onColorPaletteChange={onColorPaletteChange}
        onFontScaleChange={onFontScaleChange}
      />
    )
  };
}

describe("SettingsPage", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("uses English by default and persists an Italian selection", async () => {
    const user = userEvent.setup();
    renderSettings();

    expect(screen.getByRole("heading", { name: "Settings" })).toBeVisible();
    expect(screen.getByRole("radio", { name: /English/ })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: /Italiano/ }));

    expect(await screen.findByRole("heading", { name: "Impostazioni" })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Italiano/ })).toBeChecked();
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("it");
    expect(document.documentElement).toHaveAttribute("lang", "it");
  });

  it("reports the active palette and hands a new one to the shell", async () => {
    const user = userEvent.setup();
    const { onColorPaletteChange } = renderSettings({ colorPalette: "blue" });

    const palettes = screen.getByRole("radiogroup", { name: "Color palette" });
    expect(palettes).toBeVisible();
    expect(screen.getByRole("radio", { name: /Cool dark theme/ })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: /Natural dark theme/ }));
    expect(onColorPaletteChange).toHaveBeenCalledWith("green");
  });

  it("offers three text sizes and hands the chosen one to the shell", async () => {
    const user = userEvent.setup();
    const { onFontScaleChange } = renderSettings({ fontScale: "medium" });

    const sizes = screen.getByRole("radiogroup", { name: "Interface text size" });
    expect(sizes).toBeVisible();
    expect(screen.getByRole("radio", { name: /Recommended default/ })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: /Easier to read/ }));
    expect(onFontScaleChange).toHaveBeenCalledWith("large");

    await user.click(screen.getByRole("radio", { name: /More on screen at once/ }));
    expect(onFontScaleChange).toHaveBeenCalledWith("small");
  });
});
