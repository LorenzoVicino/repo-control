import scenarios from "../../../../fixtures/demo-scenarios.json";
import type { ProjectSummary } from "../types/projects";
import type { GitDetails } from "../types/git";
import type { WorkflowDefinition } from "../types/workflows";

export const DEMO_ROOT = "C:\\Users\\Alex\\Projects";
export const DEMO_DATE = "2026-01-15T10:00:00.000Z";
export function createDemoProjects(): ProjectSummary[] {
  return scenarios.map((scenario, index) => ({
    id: btoa(scenario.name).replace(/=/g, ""),
    name: scenario.name,
    path: `${DEMO_ROOT}\\${scenario.name}`,
    branch: "main",
    isClean: ["clean", "ahead", "behind"].includes(scenario.state),
    staged: Number(scenario.state === "staged"),
    modified: Number(scenario.state === "modified"),
    untracked: Number(scenario.state === "untracked"),
    ahead: Number(scenario.state === "ahead"),
    behind: Number(scenario.state === "behind"),
    upstream: "origin/main",
    hasDockerCompose: scenario.compose,
    lastCommit: {
      hash: `a1b2c3${index}`,
      message: "Create example project",
      author: "Alex Example",
      date: DEMO_DATE,
    },
  }));
}

export function createDemoDetails(project: ProjectSummary): GitDetails {
  const files = {
    staged: project.staged
      ? [
          {
            path: "README.md",
            previousPath: null,
            status: "staged" as const,
            label: "Modified",
          },
        ]
      : [],
    unstaged:
      project.modified || project.untracked
        ? [
            {
              path: project.untracked ? "notes.md" : "README.md",
              previousPath: null,
              status: project.untracked
                ? ("untracked" as const)
                : ("modified" as const),
              label: project.untracked ? "Untracked" : "Modified",
            },
          ]
        : [],
  };
  const summary = (count: number) => ({
    files: count,
    additions: count,
    deletions: 0,
    binaryFiles: 0,
    untrackedFiles: 0,
  });
  const branch = {
    name: "main",
    current: true,
    remote: false,
    upstream: "origin/main",
    ahead: project.ahead,
    behind: project.behind,
    merged: true,
    lastCommit: project.lastCommit,
  };
  return {
    status: {
      current: project.branch,
      detached: false,
      isClean: project.isClean,
      tracking: project.upstream,
      ahead: project.ahead,
      behind: project.behind,
      files,
      diff: {
        staged: summary(files.staged.length),
        unstaged: summary(files.unstaged.length),
      },
    },
    branches: {
      current: project.branch,
      defaultBranch: "main",
      local: [
        branch,
        {
          ...branch,
          name: "feature/onboarding",
          current: false,
          upstream: null,
        },
      ],
      remote: [
        { ...branch, name: "origin/main", current: false, remote: true },
      ],
    },
    stashes: [],
  };
}

export function createDemoWorkflow(): WorkflowDefinition {
  const nodes: WorkflowDefinition["nodes"] = [
    {
      id: "start",
      name: "Start manually",
      type: "trigger.manual",
      position: { x: 0, y: 0 },
      config: {},
    },
    {
      id: "select",
      name: "All repositories",
      type: "repository.select",
      position: { x: 300, y: 0 },
      config: { mode: "all", projectIds: [] },
    },
    {
      id: "fetch",
      name: "Fetch remote changes",
      type: "git.fetch",
      position: { x: 600, y: 0 },
      config: {},
    },
    {
      id: "summary",
      name: "Review results",
      type: "output.summary",
      position: { x: 900, y: 0 },
      config: {},
    },
  ];
  return {
    id: "demo-fetch",
    name: "Morning workspace check",
    description:
      "Simulated fetch across seven fictional repositories. No commands leave your browser.",
    nodes,
    edges: nodes
      .slice(1)
      .map((node, index) => ({
        id: `edge-${index}`,
        source: nodes[index].id,
        target: node.id,
      })),
    createdAt: DEMO_DATE,
    updatedAt: DEMO_DATE,
  };
}
