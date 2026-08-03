import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  getNpmCommand,
  getShellEnvironmentReference,
  getTerminalCommand,
  getVSCodeFailureHint,
  getVSCodeLauncherCandidates,
  isWsl,
  shouldUseShellForCommand
} from "./runtime.js";

function setPlatform(platform: NodeJS.Platform): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
  Object.defineProperty(process, "platform", { ...descriptor, value: platform });
  return () => Object.defineProperty(process, "platform", descriptor);
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test("selects shell commands and environment syntax across Unix and Windows runtimes", () => {
  const previousShell = process.env.REPO_CONTROL_SHELL;
  const previousSystemShell = process.env.SHELL;
  const restorePlatform = setPlatform("linux");

  try {
    delete process.env.REPO_CONTROL_SHELL;
    process.env.SHELL = "/bin/fish";
    assert.deepEqual(getTerminalCommand("echo hello"), {
      command: "/bin/fish",
      args: ["-c", "echo hello"],
      displayCommand: "echo hello"
    });
    assert.equal(getNpmCommand(), "npm");
    assert.equal(shouldUseShellForCommand("tool.cmd"), false);
    assert.equal(getShellEnvironmentReference("VALUE"), '"${VALUE}"');

    process.env.REPO_CONTROL_SHELL = "/bin/bash";
    assert.deepEqual(getTerminalCommand("pwd").args, ["-lc", "pwd"]);
    process.env.REPO_CONTROL_SHELL = "cmd";
    assert.deepEqual(getTerminalCommand("dir").args, ["/d", "/s", "/c", "dir"]);
    assert.equal(getShellEnvironmentReference("VALUE"), '"%VALUE%"');
    process.env.REPO_CONTROL_SHELL = "pwsh";
    assert.deepEqual(getTerminalCommand("Get-Location").args.slice(0, 4), ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass"]);
    assert.equal(getShellEnvironmentReference("VALUE"), '"$env:VALUE"');
  } finally {
    restorePlatform();
    restoreEnv("REPO_CONTROL_SHELL", previousShell);
    restoreEnv("SHELL", previousSystemShell);
  }
});

test("builds PowerShell terminal commands and Windows VS Code candidates", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-control-runtime-win-"));
  const previousConfiguredShell = process.env.REPO_CONTROL_SHELL;
  const previousConfiguredCode = process.env.REPO_CONTROL_VSCODE;
  const previousLocalAppData = process.env.LOCALAPPDATA;
  const previousProgramFiles = process.env.ProgramFiles;
  const previousProgramFilesX86 = process.env["ProgramFiles(x86)"];
  const restorePlatform = setPlatform("win32");

  try {
    delete process.env.REPO_CONTROL_SHELL;
    process.env.REPO_CONTROL_VSCODE = "custom-code.cmd";
    process.env.LOCALAPPDATA = temporaryRoot;
    delete process.env.ProgramFiles;
    delete process.env["ProgramFiles(x86)"];
    const nativeLauncher = path.join(temporaryRoot, "Programs", "Microsoft VS Code", "bin", "code.cmd");
    await fs.mkdir(path.dirname(nativeLauncher), { recursive: true });
    await fs.writeFile(nativeLauncher, "@echo off", "utf8");

    const terminal = getTerminalCommand("npm test");
    assert.equal(terminal.command, "powershell.exe");
    assert.match(terminal.args.at(-1) ?? "", /LASTEXITCODE/);
    assert.equal(getNpmCommand(), "npm.cmd");
    assert.equal(shouldUseShellForCommand("BUILD.CMD"), true);
    assert.equal(shouldUseShellForCommand("setup.bat"), true);
    assert.equal(shouldUseShellForCommand("node.exe"), false);
    assert.equal(getShellEnvironmentReference("VALUE"), '"$env:VALUE"');

    const candidates = await getVSCodeLauncherCandidates();
    assert.equal(candidates[0]?.command, "custom-code.cmd");
    assert.equal(candidates[0]?.shell, true);
    assert.ok(candidates.some((candidate) => candidate.command === "code.cmd"));
    assert.ok(candidates.some((candidate) => candidate.command === nativeLauncher));
    assert.match(await getVSCodeFailureHint(), /VS Code for Windows/);
  } finally {
    restorePlatform();
    restoreEnv("REPO_CONTROL_SHELL", previousConfiguredShell);
    restoreEnv("REPO_CONTROL_VSCODE", previousConfiguredCode);
    restoreEnv("LOCALAPPDATA", previousLocalAppData);
    restoreEnv("ProgramFiles", previousProgramFiles);
    restoreEnv("ProgramFiles(x86)", previousProgramFilesX86);
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("detects WSL and returns deduplicated Unix VS Code candidates and hints", async () => {
  const previousDistro = process.env.WSL_DISTRO_NAME;
  const previousCode = process.env.REPO_CONTROL_VSCODE;
  const restorePlatform = setPlatform("linux");

  try {
    process.env.WSL_DISTRO_NAME = "Ubuntu";
    process.env.REPO_CONTROL_VSCODE = "code";
    assert.equal(await isWsl(), true);
    const wslCandidates = await getVSCodeLauncherCandidates();
    assert.equal(wslCandidates.filter((candidate) => candidate.command === "code").length, 1);
    assert.match(await getVSCodeFailureHint(), /Remote WSL/);

    delete process.env.WSL_DISTRO_NAME;
    delete process.env.REPO_CONTROL_VSCODE;
    const nativeCandidates = await getVSCodeLauncherCandidates();
    assert.deepEqual(nativeCandidates.slice(0, 3).map((candidate) => candidate.command), ["code", "code-insiders", "codium"]);
    assert.match(await getVSCodeFailureHint(), /Remote WSL|Install the VS Code shell command/);
    assert.equal(typeof await isWsl(), "boolean");
  } finally {
    restorePlatform();
    restoreEnv("WSL_DISTRO_NAME", previousDistro);
    restoreEnv("REPO_CONTROL_VSCODE", previousCode);
  }
});
