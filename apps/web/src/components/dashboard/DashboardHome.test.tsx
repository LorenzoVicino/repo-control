import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithTheme } from "../../test/render";
import { DashboardHome } from "./DashboardHome";

describe("DashboardHome", () => {
  it("rotates bundled quotes without making a network request", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Math, "random").mockReturnValue(0);

    renderWithTheme(
      <DashboardHome
        projects={[]}
        favoriteProjectIds={[]}
        dockerStatus={undefined}
        onNavigate={vi.fn()}
        onOpenProject={vi.fn()}
      />
    );

    expect(screen.getByText(/We can only see a short distance ahead/)).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Attention" })).not.toBeInTheDocument();
    expect(screen.queryByText("Active containers")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Docker: Check services" }))
      .not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show another quote" }));
    expect(screen.getByText(/Analytical Engine/)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
