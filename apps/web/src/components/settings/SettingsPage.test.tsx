import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import i18n, { LANGUAGE_STORAGE_KEY } from "../../i18n";
import { renderWithTheme } from "../../test/render";
import { SettingsPage } from "./SettingsPage";

describe("SettingsPage", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage("en");
  });

  it("uses English by default and persists an Italian selection", async () => {
    const user = userEvent.setup();
    renderWithTheme(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "Settings" })).toBeVisible();
    expect(screen.getByRole("radio", { name: /English/ })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: /Italiano/ }));

    expect(await screen.findByRole("heading", { name: "Impostazioni" })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Italiano/ })).toBeChecked();
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("it");
    expect(document.documentElement).toHaveAttribute("lang", "it");
  });
});
