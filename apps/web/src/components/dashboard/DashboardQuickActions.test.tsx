import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../test/render";
import { DashboardQuickActions } from "./DashboardQuickActions";

describe("DashboardQuickActions", () => {
  it("maps every accessible action to its dashboard destination", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderWithTheme(<DashboardQuickActions onNavigate={onNavigate} />);

    await user.click(screen.getByRole("button", { name: "Task engineering: Crea e avvia un task" }));
    await user.click(screen.getByRole("button", { name: "Repository: Apri Git e terminale" }));
    await user.click(screen.getByRole("button", { name: "Docker: Controlla i servizi" }));
    await user.click(screen.getByRole("button", { name: "Preferiti: Riprendi il lavoro" }));

    expect(onNavigate.mock.calls.map(([destination]) => destination)).toEqual([
      "tasks",
      "repositories",
      "docker",
      "favorites"
    ]);
  });
});
