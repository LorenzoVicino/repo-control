import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createProjectFixture } from "../../test/projectFixture";
import { renderWithTheme } from "../../test/render";
import { ProjectTable } from "./ProjectTable";

describe("ProjectTable", () => {
  it("renders project details and opens rows with pointer or keyboard", async () => {
    const user = userEvent.setup();
    const onSelectProject = vi.fn();
    const projects = [
      createProjectFixture("alpha", {
        isClean: false,
        modified: 2,
        ahead: 1,
        behind: 1,
        lastCommit: { hash: "abc123", message: "Feature", date: "2026-08-01", author: "Ada" }
      }),
      createProjectFixture("beta")
    ];
    renderWithTheme(<ProjectTable projects={projects} onSelectProject={onSelectProject} />);

    expect(screen.getByText("Feature")).toBeVisible();
    expect(screen.getByText(/abc123/)).toBeVisible();
    expect(screen.getByText("Nessun commit")).toBeVisible();
    const rows = screen.getAllByRole("row").slice(1);
    await user.click(rows[0]!);
    fireEvent.keyDown(rows[1]!, { key: "Enter" });
    fireEvent.keyDown(rows[1]!, { key: " " });
    fireEvent.keyDown(rows[1]!, { key: "Escape" });
    expect(onSelectProject).toHaveBeenNthCalledWith(1, "alpha");
    expect(onSelectProject).toHaveBeenNthCalledWith(2, "beta");
    expect(onSelectProject).toHaveBeenNthCalledWith(3, "beta");
  });

  it("renders an empty result", () => {
    renderWithTheme(<ProjectTable projects={[]} onSelectProject={vi.fn()} />);
    expect(screen.getByText("Nessun repository trovato")).toBeVisible();
  });
});
