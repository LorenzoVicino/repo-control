import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertComposeProject,
  createProjectResolver,
  resolveProjectPath,
  resolveRootInput
} from "./projectResolver.js";

function encodeProjectId(relativePath: string): string {
  return Buffer.from(relativePath).toString("base64url");
}

test("resolves only repositories contained by the configured root", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-resolver-test-"));
  const repositoryPath = path.join(temporaryRoot, "group", "sample");
  const outsideRepositoryPath = path.join(path.dirname(temporaryRoot), "outside-sample");

  try {
    await fs.mkdir(path.join(repositoryPath, ".git"), { recursive: true });
    await fs.mkdir(path.join(outsideRepositoryPath, ".git"), { recursive: true });

    assert.equal(
      await resolveProjectPath(temporaryRoot, encodeProjectId("group/sample")),
      repositoryPath
    );

    await assert.rejects(
      resolveProjectPath(temporaryRoot, encodeProjectId(`../${path.basename(outsideRepositoryPath)}`)),
      /outside configured root/
    );
    await assert.rejects(
      resolveProjectPath(temporaryRoot, encodeProjectId("missing"))
    );
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
    await fs.rm(outsideRepositoryPath, { recursive: true, force: true });
  }
});

test("updates the active workspace through the resolver interface", () => {
  const initialRoot = path.resolve("initial-workspace");
  const nextRoot = path.resolve("next-workspace");
  const resolver = createProjectResolver(initialRoot);

  assert.equal(resolver.getActiveRootPath(), initialRoot);
  resolver.setActiveRootPath(nextRoot);
  assert.equal(resolver.getActiveRootPath(), nextRoot);
});

test("expands home-relative root inputs", () => {
  const homePath = process.env.HOME ?? process.cwd();

  assert.equal(resolveRootInput("~"), path.resolve(homePath));
  assert.equal(resolveRootInput("~/projects"), path.resolve(homePath, "projects"));
  assert.equal(resolveRootInput("relative-root"), path.resolve("relative-root"));
});

test("requires a supported Docker Compose file", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-compose-test-"));

  try {
    await assert.rejects(assertComposeProject(temporaryRoot), /No Docker Compose file/);
    await fs.writeFile(path.join(temporaryRoot, "compose.yaml"), "services: {}\n", "utf8");
    await assert.doesNotReject(assertComposeProject(temporaryRoot));
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});
