import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readTerminalSuggestions, rememberTerminalCommand } from "./terminalMemory.js";

test("ranks normalized terminal suggestions by project and usage", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-terminal-test-"));
  const previousConfigDirectory = process.env.REPO_CONTROL_CONFIG_DIR;
  const projectOne = path.join(temporaryRoot, "project-one");
  const projectTwo = path.join(temporaryRoot, "project-two");
  process.env.REPO_CONTROL_CONFIG_DIR = temporaryRoot;

  try {
    await rememberTerminalCommand(projectOne, "   ");
    assert.deepEqual(await readTerminalSuggestions(projectOne, ""), { suggestions: [] });

    await rememberTerminalCommand(projectOne, " npm   test ");
    await rememberTerminalCommand(projectOne, "npm test");
    await rememberTerminalCommand(projectOne, "npm run build");
    await rememberTerminalCommand(projectTwo, "npm run lint");

    assert.deepEqual(
      await readTerminalSuggestions(projectOne, "npm", 2),
      { suggestions: ["npm test", "npm run build"] }
    );
    assert.deepEqual(
      await readTerminalSuggestions(projectTwo, "NPM", 1),
      { suggestions: ["npm run lint"] }
    );
    assert.deepEqual(
      await readTerminalSuggestions(projectOne, "npm test"),
      { suggestions: [] }
    );
  } finally {
    if (previousConfigDirectory === undefined) delete process.env.REPO_CONTROL_CONFIG_DIR;
    else process.env.REPO_CONTROL_CONFIG_DIR = previousConfigDirectory;

    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("recovers from corrupt and partially invalid terminal history", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-terminal-corrupt-test-"));
  const previousConfigDirectory = process.env.REPO_CONTROL_CONFIG_DIR;
  const historyPath = path.join(temporaryRoot, "terminal-history.json");
  const projectPath = path.join(temporaryRoot, "project");
  process.env.REPO_CONTROL_CONFIG_DIR = temporaryRoot;

  try {
    await fs.writeFile(historyPath, "not-json", "utf8");
    assert.deepEqual(await readTerminalSuggestions(projectPath, "npm"), { suggestions: [] });

    await fs.writeFile(historyPath, JSON.stringify({
      entries: [
        null,
        { command: "", projectPath },
        { command: "npm run check", projectPath, count: "invalid" },
        { command: "npm run check", projectPath, count: 3, lastUsedAt: "2026-01-01T00:00:00.000Z" }
      ]
    }), "utf8");

    assert.deepEqual(
      await readTerminalSuggestions(projectPath, "npm"),
      { suggestions: ["npm run check"] }
    );
  } finally {
    if (previousConfigDirectory === undefined) delete process.env.REPO_CONTROL_CONFIG_DIR;
    else process.env.REPO_CONTROL_CONFIG_DIR = previousConfigDirectory;

    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});
