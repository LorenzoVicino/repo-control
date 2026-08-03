import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProjectFixture } from "../../test/projectFixture";
import { renderWithTheme } from "../../test/render";
import { ProjectWorkspaceTabs } from "./ProjectWorkspaceTabs";

const projects = [
  createProjectFixture("alpha", { name: "Alpha", branch: "main" }),
  createProjectFixture("beta", { name: "Beta", branch: "feature/tests", isClean: false }),
  createProjectFixture("gamma", { name: "Gamma", branch: "release" })
];

describe("ProjectWorkspaceTabs", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  it("does not render a tablist without open repositories", () => {
    renderWithTheme(
      <ProjectWorkspaceTabs
        projects={[]}
        activeProjectId={null}
        onActiveProjectChange={vi.fn()}
        onCloseProject={vi.fn()}
      />
    );

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("renders active, inactive and dirty repository state", () => {
    renderWithTheme(
      <ProjectWorkspaceTabs
        projects={projects}
        activeProjectId="beta"
        onActiveProjectChange={vi.fn()}
        onCloseProject={vi.fn()}
      />
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("aria-selected", "false");
    expect(tabs[0]).toHaveAttribute("tabindex", "-1");
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    expect(tabs[1]).toHaveAttribute("tabindex", "0");
    expect(screen.getByLabelText("Repository con modifiche locali")).toBeVisible();
    expect(screen.getByText("feature/tests")).toBeVisible();
  });

  it("activates tabs by click and supports wrapped keyboard navigation", async () => {
    const user = userEvent.setup();
    const onActiveProjectChange = vi.fn();
    renderWithTheme(
      <ProjectWorkspaceTabs
        projects={projects}
        activeProjectId={null}
        onActiveProjectChange={onActiveProjectChange}
        onCloseProject={vi.fn()}
      />
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    await user.click(tabs[1]!);
    fireEvent.keyDown(tabs[2]!, { key: "ArrowRight" });
    expect(onActiveProjectChange).toHaveBeenLastCalledWith("alpha");
    expect(tabs[0]).toHaveFocus();

    fireEvent.keyDown(tabs[0]!, { key: "ArrowLeft" });
    expect(onActiveProjectChange).toHaveBeenLastCalledWith("gamma");
    expect(tabs[2]).toHaveFocus();

    fireEvent.keyDown(tabs[1]!, { key: "Home" });
    expect(onActiveProjectChange).toHaveBeenLastCalledWith("alpha");
    fireEvent.keyDown(tabs[0]!, { key: "End" });
    expect(onActiveProjectChange).toHaveBeenLastCalledWith("gamma");

    fireEvent.keyDown(tabs[1]!, { key: "Escape" });
    expect(onActiveProjectChange).toHaveBeenCalledTimes(5);
  });

  it("closes a repository without activating it and focuses the nearest fallback", async () => {
    const user = userEvent.setup();
    const onCloseProject = vi.fn();
    const onActiveProjectChange = vi.fn();
    renderWithTheme(
      <ProjectWorkspaceTabs
        projects={projects}
        activeProjectId="alpha"
        onActiveProjectChange={onActiveProjectChange}
        onCloseProject={onCloseProject}
      />
    );

    const closeBeta = screen.getByRole("button", { name: "Chiudi Beta" });
    fireEvent.mouseDown(closeBeta);
    await user.click(closeBeta);
    expect(onCloseProject).toHaveBeenCalledWith("beta");
    expect(onActiveProjectChange).not.toHaveBeenCalled();
    expect(screen.getAllByRole("tab")[2]).toHaveFocus();
  });

  it("falls back to the previous tab and handles closing the only tab", async () => {
    const user = userEvent.setup();
    const onCloseProject = vi.fn();
    const view = renderWithTheme(
      <ProjectWorkspaceTabs
        projects={projects.slice(0, 2)}
        activeProjectId="beta"
        onActiveProjectChange={vi.fn()}
        onCloseProject={onCloseProject}
      />
    );

    await user.click(screen.getByRole("button", { name: "Chiudi Beta" }));
    expect(screen.getAllByRole("tab")[0]).toHaveFocus();

    view.rerender(
      <ProjectWorkspaceTabs
        projects={projects.slice(0, 1)}
        activeProjectId="alpha"
        onActiveProjectChange={vi.fn()}
        onCloseProject={onCloseProject}
      />
    );
    await user.click(screen.getByRole("button", { name: "Chiudi Alpha" }));
    expect(onCloseProject).toHaveBeenLastCalledWith("alpha");
  });
});
