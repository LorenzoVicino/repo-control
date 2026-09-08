import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const scenarios = JSON.parse(
  await fs.readFile(
    new URL("../fixtures/demo-scenarios.json", import.meta.url),
    "utf8",
  ),
);
export async function createDemoWorkspace(destination) {
  // mkdir without recursive is an intentional refusal to overwrite anything existing.
  const directory = destination
    ? path.resolve(destination)
    : await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-demo-"));
  if (destination) await fs.mkdir(directory);
  const workspace = path.join(directory, "workspace");
  const support = path.join(directory, "support");
  await fs.mkdir(workspace);
  await fs.mkdir(support);
  const gitEnv = {
    ...process.env,
    GIT_CONFIG_NOSYSTEM: "1",
    // A regular path works on every supported Node/Git combination. In particular,
    // Git for Windows rejects Node 20's \\.\nul spelling of os.devNull.
    GIT_CONFIG_GLOBAL: path.join(support, ".gitconfig"),
    GIT_AUTHOR_NAME: "Alex Example",
    GIT_AUTHOR_EMAIL: "alex@example.invalid",
    GIT_COMMITTER_NAME: "Alex Example",
    GIT_COMMITTER_EMAIL: "alex@example.invalid",
    GIT_AUTHOR_DATE: "2026-01-15T10:00:00Z",
    GIT_COMMITTER_DATE: "2026-01-15T10:00:00Z",
  };
  const git = (cwd, ...args) =>
    exec(
      "git",
      ["-c", "core.autocrlf=false", "-c", "commit.gpgsign=false", ...args],
      { cwd, env: gitEnv },
    );
  for (const scenario of scenarios) {
    const repo = path.join(workspace, scenario.name);
    const remote = path.join(support, `${scenario.name}.git`);
    await fs.mkdir(repo);
    await git(repo, "init", "--initial-branch=main");
    await fs.writeFile(
      path.join(repo, "README.md"),
      `# ${scenario.name}\n\nA fictional repo-control demo repository.\n`,
    );
    if (scenario.compose)
      await fs.writeFile(
        path.join(repo, "compose.yaml"),
        "services:\n  web:\n    image: nginx:alpine\n",
      );
    await git(repo, "add", ".");
    await git(repo, "commit", "-m", "Create example project");
    await git(support, "init", "--bare", "--initial-branch=main", remote);
    await git(repo, "remote", "add", "origin", remote);
    await git(repo, "push", "--set-upstream", "origin", "main");
    if (["modified", "staged", "ahead"].includes(scenario.state)) {
      await fs.appendFile(
        path.join(repo, "README.md"),
        "\nDocument the getting-started workflow.\n",
      );
      if (scenario.state !== "modified") await git(repo, "add", "README.md");
      if (scenario.state === "ahead")
        await git(repo, "commit", "-m", "Document getting started");
    }
    if (scenario.state === "untracked")
      await fs.writeFile(
        path.join(repo, "notes.md"),
        "# Next steps\nTry repo-control.\n",
      );
    if (scenario.state === "behind") {
      const writer = path.join(support, "documentation-writer");
      await git(support, "clone", remote, writer);
      await fs.appendFile(
        path.join(writer, "README.md"),
        "\nPublished documentation update.\n",
      );
      await git(writer, "add", ".");
      await git(writer, "commit", "-m", "Publish documentation update");
      await git(writer, "push");
      await git(repo, "fetch");
    }
  }
  return workspace;
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  const workspace = await createDemoWorkspace(process.argv[2]);
  console.log(
    `Demo workspace created: ${workspace}\nRun: npx repo-control ${JSON.stringify(workspace)}`,
  );
}
