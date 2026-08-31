import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// repo-control runs from two different layouts: a Git checkout (apps/server/src/... under
// tsx) and an installed package (dist/server/... under npx). A fixed relative offset would
// be wrong in one of them, so walk up to the package.json that names this package instead.
//
// This matters beyond tidiness: process.cwd() is the *user's* workspace when repo-control
// is started with npx, so anything that acts on repo-control's own files - notably the
// self-updater - must resolve its root from the module location, never from the cwd.
const PACKAGE_NAME = "repo-control";

function findPackageRoot(startDirectory: string): string {
  let currentDirectory = startDirectory;

  for (;;) {
    const packageJsonPath = path.join(currentDirectory, "package.json");

    if (existsSync(packageJsonPath)) {
      try {
        const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: unknown };

        if (parsed.name === PACKAGE_NAME) {
          return currentDirectory;
        }
      } catch {
        // A malformed package.json higher up the tree should not stop the walk.
      }
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      // Nothing matched up to the filesystem root. Fall back to the module's own directory
      // rather than the cwd, which would point at the user's workspace under npx.
      return startDirectory;
    }

    currentDirectory = parentDirectory;
  }
}

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

export const appRootPath = findPackageRoot(moduleDirectory);

export const webDistPath = path.join(appRootPath, "apps", "web", "dist");

export function hasBuiltWebAssets(): boolean {
  return existsSync(path.join(webDistPath, "index.html"));
}
