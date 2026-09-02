import type { DockerContainer, DockerContainersResponse } from "../../types/docker";
import type { ProjectSummary } from "../../types/projects";
import type { WorkflowRun } from "../../types/workflows";

export type WorkspaceSummary = {
  total: number;
  inSync: number;
  dirty: number;
  behind: number;
  ahead: number;
  localChanges: number;
  attention: number;
};

export type ContainerHealth = "unhealthy" | "restarting" | "healthy" | "running" | "unknown";

export type AttentionSeverity = "critical" | "warning" | "action" | "info";

export type AttentionReason =
  | { kind: "containersUnhealthy"; count: number }
  | { kind: "containersRestarting"; count: number }
  | { kind: "runFailed"; startedAt: string }
  | { kind: "runInterrupted"; startedAt: string }
  | { kind: "behind"; count: number }
  | { kind: "changes"; staged: number; modified: number; untracked: number }
  | { kind: "ahead"; count: number };

export type AttentionTarget =
  | { type: "project"; projectId: string }
  | { type: "section"; section: "docker" | "automations" };

export type AttentionItem = {
  id: string;
  severity: AttentionSeverity;
  title: string;
  // The repository or workflow the item belongs to, when the title is something else.
  context: string | null;
  reasons: AttentionReason[];
  target: AttentionTarget;
};

const SEVERITY_RANK: Record<AttentionSeverity, number> = { critical: 0, warning: 1, action: 2, info: 3 };

export function getLocalChangeCount(project: ProjectSummary): number {
  return project.staged + project.modified + project.untracked;
}

export function needsAttention(project: ProjectSummary): boolean {
  return !project.isClean || project.behind > 0;
}

export type ProjectState = "changes" | "behind" | "ahead" | "inSync";

// Each repository lands in exactly one state, most pressing first, so a distribution over
// these adds up to the repository count.
export function classifyProject(project: ProjectSummary): ProjectState {
  if (!project.isClean) return "changes";
  if (project.behind > 0) return "behind";
  if (project.ahead > 0) return "ahead";
  return "inSync";
}

// Theme palette path for the state's dot or figure.
export const PROJECT_STATE_TONE: Record<ProjectState, string> = {
  changes: "warning.main",
  behind: "error.main",
  ahead: "info.main",
  inSync: "success.main"
};

export function getProjectStateTone(project: ProjectSummary): string {
  return PROJECT_STATE_TONE[classifyProject(project)];
}

export function buildWorkspaceSummary(projects: ProjectSummary[]): WorkspaceSummary {
  return {
    total: projects.length,
    inSync: projects.filter((project) => project.isClean && project.behind === 0 && project.ahead === 0).length,
    dirty: projects.filter((project) => !project.isClean).length,
    behind: projects.filter((project) => project.behind > 0).length,
    ahead: projects.filter((project) => project.ahead > 0).length,
    localChanges: projects.reduce((total, project) => total + getLocalChangeCount(project), 0),
    attention: projects.filter(needsAttention).length
  };
}

// `docker ps` reports a free-text status such as "Up 2 minutes (unhealthy)"; only running
// containers are listed, so an exited one never reaches this function.
export function getContainerHealth(container: Pick<DockerContainer, "status">): ContainerHealth {
  const normalized = container.status.toLowerCase();
  if (normalized.includes("unhealthy")) return "unhealthy";
  if (normalized.includes("restarting") || normalized.includes("starting")) return "restarting";
  if (normalized.includes("healthy")) return "healthy";
  if (normalized.startsWith("up")) return "running";
  return "unknown";
}

type AttentionInput = {
  projects: ProjectSummary[];
  dockerStatus: DockerContainersResponse | undefined;
  runs: WorkflowRun[];
};

// One queue, most severe first: a container that is failing, then an automation that did
// not finish, then repositories with work to pull, commit or push. Repository items are
// one per repository however many reasons apply, so a dirty repository that is also behind
// is one row with two reasons, not two rows competing for the same click.
export function buildAttentionQueue({ projects, dockerStatus, runs }: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (dockerStatus?.ok) {
    for (const group of dockerStatus.groups) {
      const unhealthy = group.containers.filter((container) => getContainerHealth(container) === "unhealthy").length;
      const restarting = group.containers.filter((container) => getContainerHealth(container) === "restarting").length;
      if (unhealthy === 0 && restarting === 0) continue;

      const reasons: AttentionReason[] = [];
      if (unhealthy > 0) reasons.push({ kind: "containersUnhealthy", count: unhealthy });
      if (restarting > 0) reasons.push({ kind: "containersRestarting", count: restarting });
      const project = group.workingDir ? findProjectByPath(projects, group.workingDir) : null;

      items.push({
        id: `container:${group.id}`,
        severity: unhealthy > 0 ? "critical" : "warning",
        title: group.name,
        context: project?.name ?? null,
        reasons,
        target: project ? { type: "project", projectId: project.id } : { type: "section", section: "docker" }
      });
    }
  }

  for (const run of getLatestRunPerWorkflow(runs)) {
    if (run.status !== "failed" && run.status !== "interrupted") continue;
    items.push({
      id: `run:${run.id}`,
      severity: run.status === "failed" ? "warning" : "action",
      title: run.workflowName,
      context: null,
      reasons: [run.status === "failed"
        ? { kind: "runFailed", startedAt: run.startedAt }
        : { kind: "runInterrupted", startedAt: run.startedAt }],
      target: { type: "section", section: "automations" }
    });
  }

  for (const project of projects) {
    const reasons: AttentionReason[] = [];
    if (project.behind > 0) reasons.push({ kind: "behind", count: project.behind });
    if (!project.isClean) {
      reasons.push({ kind: "changes", staged: project.staged, modified: project.modified, untracked: project.untracked });
    }
    if (project.ahead > 0) reasons.push({ kind: "ahead", count: project.ahead });
    if (reasons.length === 0) continue;

    items.push({
      id: `project:${project.id}`,
      severity: project.behind > 0 ? "warning" : !project.isClean ? "action" : "info",
      title: project.name,
      context: project.branch,
      reasons,
      target: { type: "project", projectId: project.id }
    });
  }

  // Within one severity a failing container or an unfinished run - an anomaly - comes
  // before repository housekeeping, which is the normal state of a working day.
  return items.sort((left, right) =>
    SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity]
    || getKindRank(left) - getKindRank(right)
    || getAttentionWeight(right) - getAttentionWeight(left)
    || left.title.localeCompare(right.title)
  );
}

function getKindRank(item: AttentionItem): number {
  if (item.id.startsWith("container:")) return 0;
  if (item.id.startsWith("run:")) return 1;
  return 2;
}

// Within one severity, the item with more to do comes first.
function getAttentionWeight(item: AttentionItem): number {
  return item.reasons.reduce((total, reason) => {
    if (reason.kind === "changes") return total + reason.staged + reason.modified + reason.untracked;
    if ("count" in reason) return total + reason.count;
    return total + 1;
  }, 0);
}

function getLatestRunPerWorkflow(runs: WorkflowRun[]): WorkflowRun[] {
  const latestByWorkflow = new Map<string, WorkflowRun>();
  for (const run of runs) {
    if (run.mode !== "run") continue;
    const current = latestByWorkflow.get(run.workflowId);
    if (!current || Date.parse(run.startedAt) > Date.parse(current.startedAt)) {
      latestByWorkflow.set(run.workflowId, run);
    }
  }
  return [...latestByWorkflow.values()];
}

function findProjectByPath(projects: ProjectSummary[], workingDir: string): ProjectSummary | null {
  const normalizedDir = normalizePath(workingDir);
  return projects.find((project) => normalizePath(project.path) === normalizedDir) ?? null;
}

function normalizePath(value: string): string {
  return value.replace(/[\\/]+$/, "").toLocaleLowerCase();
}

// Where to pick up: the repositories opened most recently, then favorites that were not
// opened recently, then whatever has the newest commit. Each source keeps its own order.
export function getResumeProjects(
  projects: ProjectSummary[],
  recentProjectIds: string[],
  favoriteProjectIds: string[],
  limit: number
): { project: ProjectSummary; source: "recent" | "favorite" | "commit" }[] {
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const seen = new Set<string>();
  const result: { project: ProjectSummary; source: "recent" | "favorite" | "commit" }[] = [];

  const push = (project: ProjectSummary | undefined, source: "recent" | "favorite" | "commit") => {
    if (!project || seen.has(project.id) || result.length >= limit) return;
    seen.add(project.id);
    result.push({ project, source });
  };

  for (const projectId of recentProjectIds) push(projectsById.get(projectId), "recent");
  for (const projectId of favoriteProjectIds) push(projectsById.get(projectId), "favorite");
  for (const project of [...projects].sort((left, right) => getCommitTimestamp(right) - getCommitTimestamp(left))) {
    if (project.lastCommit) push(project, "commit");
  }

  return result;
}

export function getCommitTimestamp(project: ProjectSummary): number {
  const timestamp = Date.parse(project.lastCommit?.date ?? "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

// Most recently opened first, deduplicated, capped - the shape the server stores.
export function pushRecentProjectId(recentProjectIds: string[], projectId: string, limit: number): string[] {
  return [projectId, ...recentProjectIds.filter((id) => id !== projectId)].slice(0, limit);
}
