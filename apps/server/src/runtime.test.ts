import assert from "node:assert/strict";
import test from "node:test";
import { getShellEnvironmentReference } from "./runtime.js";

test("formats workflow input environment references for supported shells", () => {
  const previousShell = process.env.REPO_CONTROL_SHELL;

  try {
    process.env.REPO_CONTROL_SHELL = "/bin/bash";
    assert.equal(
      getShellEnvironmentReference("REPO_CONTROL_INPUT_MESSAGE"),
      '"${REPO_CONTROL_INPUT_MESSAGE}"'
    );

    process.env.REPO_CONTROL_SHELL = "powershell.exe";
    assert.equal(
      getShellEnvironmentReference("REPO_CONTROL_INPUT_MESSAGE"),
      '"$env:REPO_CONTROL_INPUT_MESSAGE"'
    );

    process.env.REPO_CONTROL_SHELL = "cmd.exe";
    assert.equal(
      getShellEnvironmentReference("REPO_CONTROL_INPUT_MESSAGE"),
      '"%REPO_CONTROL_INPUT_MESSAGE%"'
    );
  } finally {
    if (previousShell === undefined) {
      delete process.env.REPO_CONTROL_SHELL;
    } else {
      process.env.REPO_CONTROL_SHELL = previousShell;
    }
  }
});
