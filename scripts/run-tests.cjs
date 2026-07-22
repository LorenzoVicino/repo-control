const { readdirSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const serverSourceRoot = path.join(repositoryRoot, "apps", "server", "src");

function findTestFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return findTestFiles(entryPath);
      }

      return /\.(?:test|spec)\.(?:ts|tsx)$/.test(entry.name) ? [entryPath] : [];
    });
}

const testFiles = findTestFiles(serverSourceRoot)
  .map((filePath) => path.relative(repositoryRoot, filePath))
  .sort();

if (testFiles.length === 0) {
  console.error("No TypeScript server test files found under apps/server/src/");
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", ...process.argv.slice(2), ...testFiles],
  {
    cwd: repositoryRoot,
    env: process.env,
    stdio: "inherit"
  }
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
