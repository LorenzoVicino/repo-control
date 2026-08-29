import { describe, expect, it } from "vitest";
import { createProjectFixture } from "../test/projectFixture";
import {
  filterProjects,
  getProjectAccentColor,
  getStats,
  groupProjects,
  isProject
} from "./projects";

describe("project utilities", () => {
  const clean = createProjectFixture("clean", { path: "/workspace/clean", hasDockerCompose: true });
  const dirty = createProjectFixture("dirty", {
    path: "/workspace/group/dirty",
    isClean: false,
    modified: 2
  });
  const behind = createProjectFixture("behind", {
    path: "/workspace/group/behind",
    branch: "develop",
    behind: 2
  });
  const ahead = createProjectFixture("ahead", {
    path: "/external/ahead",
    ahead: 1,
    upstream: "upstream/main"
  });
  const projects = [clean, dirty, behind, ahead];

  it("summarizes and filters repository health fields", () => {
    expect(getStats(projects)).toEqual({ total: 4, clean: 3, dirty: 1, behind: 1, compose: 1 });
    expect(filterProjects(projects, "  ")).toBe(projects);
    expect(filterProjects(projects, "DEVELOP")).toEqual([behind]);
    expect(filterProjects(projects, "upstream/main")).toEqual([ahead]);
    expect(isProject(undefined)).toBe(false);
    expect(isProject(clean)).toBe(true);
  });

  it("groups repositories by workspace folder and orders risky projects first", () => {
    const groups = groupProjects(projects, "/workspace/");

    expect(groups.map((group) => group.label)).toEqual(["external", "group", "root"]);
    expect(groups.find((group) => group.label === "group")?.projects.map((project) => project.id)).toEqual([
      "dirty",
      "behind"
    ]);
  });

  it("assigns a distinct accent colour to every repository state", () => {
    const colors = [dirty, behind, ahead, clean].map(getProjectAccentColor);

    // Dirty outranks behind, which outranks ahead: the checks are ordered, so a dirty
    // repository that is also behind must still read as dirty.
    expect(colors).toEqual(["#d97706", "#e11d48", "#0ea5e9", "#059669"]);
    expect(new Set(colors).size).toBe(4);
  });
});
