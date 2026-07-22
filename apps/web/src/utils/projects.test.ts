import { describe, expect, it } from "vitest";
import { createProjectFixture } from "../test/projectFixture";
import {
  filterProjects,
  getProjectTone,
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

  it("assigns distinct visual tones for every repository state", () => {
    expect(getProjectTone(dirty, "light")).toMatchObject({ label: "modificato", chipColor: "warning" });
    expect(getProjectTone(behind, "dark")).toMatchObject({ label: "behind", chipColor: "secondary" });
    expect(getProjectTone(ahead, "light")).toMatchObject({ label: "ahead", chipColor: "info" });
    expect(getProjectTone(clean, "dark")).toMatchObject({ label: "pulito", chipColor: "success" });
  });
});
