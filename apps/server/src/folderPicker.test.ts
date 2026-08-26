import assert from "node:assert/strict";
import test from "node:test";
import { openNativeFolderPicker } from "./folderPicker.js";

function setPlatform(platform: NodeJS.Platform): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
  Object.defineProperty(process, "platform", { ...descriptor, value: platform });
  return () => Object.defineProperty(process, "platform", descriptor);
}

function result(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    command: "picker",
    exitCode: 0,
    stdout: "",
    stderr: "",
    output: "",
    durationMs: 1,
    ...overrides
  };
}

test("normalizes native picker output and reports all platform candidates", async () => {
  const restorePlatform = setPlatform("linux");
  const previousDistro = process.env.WSL_DISTRO_NAME;
  delete process.env.WSL_DISTRO_NAME;

  try {
    const calls: Array<{ command: string; args: string[]; timeout: number }> = [];
    const selected = await openNativeFolderPicker("/workspace/start", async (_cwd, command, args, timeout) => {
      calls.push({ command, args, timeout: timeout ?? 0 });
      return result({ command, stdout: " /workspace/selected\r\n" });
    });
    assert.deepEqual(selected, { ok: true, path: "/workspace/selected" });
    const firstPicker = calls[0]!;
    assert.ok(firstPicker.command.endsWith("powershell.exe") || firstPicker.command === "zenity");
    assert.ok(firstPicker.args.some((arg) => arg.includes("/workspace/start")));
    assert.equal(calls[0]?.timeout, 120_000);

    let attempts = 0;
    const failed = await openNativeFolderPicker("/workspace", async (_cwd, command) => {
      attempts += 1;
      return result({ ok: false, command, exitCode: null, output: `${command} unavailable` });
    });
    assert.equal(attempts, 2);
    assert.equal(failed.ok, false);
    assert.match(failed.message ?? "", /Unable to open/);
    assert.ok((failed.message ?? "").includes(firstPicker.command));
  } finally {
    restorePlatform();
    if (previousDistro === undefined) delete process.env.WSL_DISTRO_NAME;
    else process.env.WSL_DISTRO_NAME = previousDistro;
  }
});

test("distinguishes empty successful selections and explicit cancellation", async () => {
  const restorePlatform = setPlatform("linux");
  const previousDistro = process.env.WSL_DISTRO_NAME;
  delete process.env.WSL_DISTRO_NAME;

  try {
    assert.deepEqual(
      await openNativeFolderPicker("/", async () => result({ stdout: "" })),
      { ok: false, cancelled: true }
    );
    assert.deepEqual(
      await openNativeFolderPicker("/", async () => result({ ok: false, exitCode: 1, output: "User cancelled", stdout: "" })),
      { ok: false, cancelled: true }
    );
    assert.deepEqual(
      await openNativeFolderPicker("/", async () => result({ ok: false, exitCode: 1, output: "", stdout: "" })),
      { ok: false, cancelled: true }
    );
  } finally {
    restorePlatform();
    if (previousDistro === undefined) delete process.env.WSL_DISTRO_NAME;
    else process.env.WSL_DISTRO_NAME = previousDistro;
  }
});

test("builds WSL PowerShell candidates and converts Windows and WSL share paths", async () => {
  const restorePlatform = setPlatform("linux");
  const previousDistro = process.env.WSL_DISTRO_NAME;
  process.env.WSL_DISTRO_NAME = "Ubuntu-24.04";

  try {
    const calls: Array<{ command: string; args: string[] }> = [];
    const drive = await openNativeFolderPicker("/mnt/c/Users/O'Brien/work", async (_cwd, command, args) => {
      calls.push({ command, args });
      return result({ command, stdout: "C:\\Users\\developer\\project\n" });
    });
    assert.deepEqual(drive, { ok: true, path: "/mnt/c/Users/developer/project" });
    assert.match(calls[0]?.command ?? "", /powershell\.exe$/);
    assert.ok(calls[0]?.args.at(-1)?.includes("C:\\Users\\O''Brien\\work"));

    const share = await openNativeFolderPicker("/home/developer/project", async () =>
      result({ stdout: "\\\\wsl.localhost\\Ubuntu-24.04\\home\\developer\\selected\n" })
    );
    assert.deepEqual(share, { ok: true, path: "/home/developer/selected" });
  } finally {
    restorePlatform();
    if (previousDistro === undefined) delete process.env.WSL_DISTRO_NAME;
    else process.env.WSL_DISTRO_NAME = previousDistro;
  }
});

test("stops after a picker timeout instead of opening another dialog", async () => {
  const restorePlatform = setPlatform("win32");

  try {
    let attempts = 0;
    const timedOut = await openNativeFolderPicker("C:\\work", async (_cwd, command) => {
      attempts += 1;
      return result({
        ok: false,
        command,
        exitCode: null,
        stderr: "Command timed out after 120000ms",
        output: "Command timed out after 120000ms"
      });
    });

    assert.equal(attempts, 1);
    assert.equal(timedOut.ok, false);
    assert.match(timedOut.message ?? "", /timed out after 2 minutes/);
  } finally {
    restorePlatform();
  }
});

test("uses Windows and macOS picker commands without Unix path conversion", async () => {
  const windowsRestore = setPlatform("win32");
  try {
    const calls: Array<{ command: string; args: string[] }> = [];
    const picked = await openNativeFolderPicker("C:\\work", async (_cwd, command, args) => {
      calls.push({ command, args });
      return result({ command, stdout: "D:\\repos\\product\n" });
    });
    assert.deepEqual(picked, { ok: true, path: "D:\\repos\\product" });
    assert.equal(calls[0]?.command, "powershell.exe");
    assert.match(calls[0]?.args.at(-1) ?? "", /RepoControlFolderPicker/);
  } finally {
    windowsRestore();
  }

  const macRestore = setPlatform("darwin");
  try {
    const calls: Array<{ command: string; args: string[] }> = [];
    const picked = await openNativeFolderPicker("/Users/test", async (_cwd, command, args) => {
      calls.push({ command, args });
      return result({ command, stdout: "/Users/test/project\n" });
    });
    assert.deepEqual(picked, { ok: true, path: "/Users/test/project" });
    assert.equal(calls[0]?.command, "osascript");
    assert.deepEqual(calls[0]?.args.slice(0, 1), ["-e"]);
  } finally {
    macRestore();
  }
});
