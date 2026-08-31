import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApprovedBrainTask, readBrainTask } from "./brainService.js";

test("creates an AI-planned task with every planning gate approved atomically", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-brain-test-"));
  const projectPath = path.join(temporaryRoot, "sample-project");
  const previousConfigDirectory = process.env.REPO_CONTROL_CONFIG_DIR;
  process.env.REPO_CONTROL_CONFIG_DIR = path.join(temporaryRoot, "config");
  await fs.mkdir(projectPath, { recursive: true });

  try {
    const task = await createApprovedBrainTask(projectPath, {
      title: "Assisted plan",
      type: "feature",
      definition: {
        description: "Desired outcome",
        motivation: "Reduce the manual work"
      },
      requirements: "## Requirements\n- One",
      design: "## Approach\nUse the existing service",
      breakdown: "## Steps\n1. Implement",
      verificationChecks: ["npm run check"],
      planning: {
        profile: "full",
        provider: "claude",
        brief: "Prepare the change",
        generatedAt: new Date().toISOString(),
        assumptions: ["The contract stays compatible"]
      },
      claudeSessionId: "session-1"
    });

    assert.equal(task.status, "implementation");
    assert.ok(task.requirements.approvedAt);
    assert.ok(task.design.approvedAt);
    assert.ok(task.breakdown.approvedAt);
    assert.deepEqual(task.verificationChecks, ["npm run check"]);
    assert.equal(task.planning.provider, "claude");
    assert.equal(task.claudeSessionId, "session-1");

    const persistedTask = await readBrainTask(projectPath, task.id);
    assert.equal(persistedTask?.status, "implementation");
    assert.equal(persistedTask?.planning.profile, "full");
  } finally {
    if (previousConfigDirectory === undefined) {
      delete process.env.REPO_CONTROL_CONFIG_DIR;
    } else {
      process.env.REPO_CONTROL_CONFIG_DIR = previousConfigDirectory;
    }
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});
