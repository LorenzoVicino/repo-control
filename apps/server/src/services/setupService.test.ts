import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { detectSetupTools } from "./setupService.js";
import {
  hasExistingConfiguration,
  readPreferences,
  writePreferences,
} from "../preferences.js";
import { isExecutableAvailable } from "./agentSessionService.js";

test("setup completion persists without dropping existing workspace preferences", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-setup-"));
  const previous = process.env.REPO_CONTROL_CONFIG_DIR;
  process.env.REPO_CONTROL_CONFIG_DIR = dir;
  try {
    assert.equal(await hasExistingConfiguration(), false);
    await writePreferences({ favoriteProjectIds: ["example"] });
    await writePreferences({ onboardingVersion: 1 });
    assert.equal(await hasExistingConfiguration(), true);
    assert.equal((await readPreferences()).onboardingVersion, 1);
    assert.deepEqual((await readPreferences()).favoriteProjectIds, ["example"]);
    await writePreferences({ recentProjectIds: ["example"] });
    assert.equal((await readPreferences()).onboardingVersion, 1);
  } finally {
    if (previous === undefined) delete process.env.REPO_CONTROL_CONFIG_DIR;
    else process.env.REPO_CONTROL_CONFIG_DIR = previous;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
test("detects tools without executing agent CLIs and reports a disconnected Docker daemon", async () => {
  const commands: string[] = [];
  const tools = await detectSetupTools(async (_cwd, command) => {
    commands.push(command);
    return {
      ok: false,
      command,
      exitCode: 1,
      stdout: "",
      stderr: "offline",
      output: "offline",
      durationMs: 1,
    };
  });
  assert.equal(tools.length, 6);
  assert.equal(tools.find((tool) => tool.id === "git")?.required, true);
  assert.ok(commands.every((command) => command === "docker"));
  if (commands.length)
    assert.equal(
      tools.find((tool) => tool.id === "docker")?.status,
      "unreachable",
    );
  assert.equal(
    await isExecutableAvailable("repo-control-nonexistent-binary", {}),
    false,
  );
  assert.equal(
    await isExecutableAvailable(process.execPath, process.env),
    true,
  );
});
