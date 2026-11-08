import path from "node:path";
import type { ProjectSummary } from "../../gitScanner.js";
import { ToolError } from "./types.js";

// An agent names repositories the way a person does: "atlas-api", "services/atlas-api" or
// the opaque ID it saw in an earlier result. This turns any of those into exactly one
// discovered repository, or into an error that lists what it could have meant.

const MAX_LISTED_CANDIDATES = 12;

export function matchRepository(projects: ProjectSummary[], rootPath: string, reference: string): ProjectSummary {
  const wanted = reference.trim();
  if (!wanted) throw new ToolError("A repository name, relative path or ID is required.");

  const byId = projects.find((project) => project.id === wanted);
  if (byId) return byId;

  const normalized = wanted.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const relativePathOf = (project: ProjectSummary) =>
    (path.relative(rootPath, project.path) || ".").replace(/\\/g, "/").toLowerCase();

  const byPath = projects.filter((project) => relativePathOf(project) === normalized);
  if (byPath.length === 1) return byPath[0];

  const byName = projects.filter((project) => project.name.toLowerCase() === normalized);
  if (byName.length === 1) return byName[0];
  if (byName.length > 1) {
    const options = byName.map((project) => relativePathOf(project)).join(", ");
    throw new ToolError(`"${wanted}" matches ${byName.length} repositories: ${options}. Use the relative path instead.`);
  }

  const known = projects
    .slice(0, MAX_LISTED_CANDIDATES)
    .map((project) => project.name)
    .join(", ");
  const more = projects.length > MAX_LISTED_CANDIDATES ? `, and ${projects.length - MAX_LISTED_CANDIDATES} more` : "";
  throw new ToolError(
    projects.length === 0
      ? `No repository called "${wanted}": the workspace has no Git repositories.`
      : `No repository called "${wanted}". Known repositories: ${known}${more}.`
  );
}
