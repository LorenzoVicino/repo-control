import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { createDemoWorkspace } from "./demo-workspace.mjs";

const exec = promisify(execFile);
const repository = fileURLToPath(new URL("../", import.meta.url));
const temporary = await fs.mkdtemp(
  path.join(os.tmpdir(), "repo-control-package-"),
);
const env = {
  ...process.env,
  REPO_CONTROL_CONFIG_DIR: path.join(temporary, "config"),
  HOST: "127.0.0.1",
  LOG_LEVEL: "error",
};
for (const key of [
  "REPO_CONTROL_AUTH_USERNAME",
  "REPO_CONTROL_AUTH_PASSWORD",
  "REPO_CONTROL_ROOT",
  "REPO_CONTROL_SERVE_WEB",
  "REPO_CONTROL_SHELL",
])
  delete env[key];
let child;
let browser;
let output = "";
let base;
const npmCli = process.env.npm_execpath;
assert.ok(
  npmCli,
  "Run this check with npm run test:package (npm_execpath is required).",
);
const npm = (args, cwd) =>
  exec(process.execPath, [npmCli, ...args], {
    cwd,
    env,
    maxBuffer: 8 * 1024 * 1024,
  });

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function api(route, body) {
  const response = await fetch(
    `${base}/api/${route}`,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  assert.ok(
    response.ok,
    `${route}: HTTP ${response.status} ${await response.clone().text()}`,
  );
  return response.json();
}
async function canonicalPath(value) {
  const resolved = await fs.realpath(value.trim());
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
async function stop() {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32")
    await exec("taskkill", ["/pid", String(child.pid), "/T", "/F"]).catch(
      () => {},
    );
  else child.kill("SIGTERM");
  for (let attempt = 0; attempt < 40 && child.exitCode === null; attempt++)
    await delay(100);
  if (child.exitCode === null) child.kill("SIGKILL");
}

// Speaks newline-delimited JSON-RPC to `repo-control mcp` the way an MCP client does. Run
// through node rather than the npm shim: the subject is the installed command, and stdout
// has to stay a clean protocol stream on every platform.
async function mcpStdioSession(binary, workspace) {
  const server = spawn(process.execPath, [binary, "mcp", workspace], { env });
  let buffer = "";
  let stderr = "";
  const pending = new Map();
  server.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  server.stdout.on("data", (chunk) => {
    buffer += chunk;
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const message = JSON.parse(line);
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    }
  });
  let nextId = 1;
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(
        () => reject(new Error(`MCP ${method} timed out: ${stderr}`)),
        30_000,
      );
      pending.set(id, (message) => {
        clearTimeout(timer);
        if (message.error) reject(new Error(`MCP ${method}: ${message.error.message}`));
        else resolve(message.result);
      });
      server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  try {
    const initialized = await request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "package-smoke", version: "1.0.0" },
    });
    server.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    const { tools } = await request("tools/list", {});
    const listed = await request("tools/call", { name: "list_repositories", arguments: {} });
    return { initialized, tools: tools.map((tool) => tool.name), listed, stderr };
  } finally {
    server.kill();
  }
}

try {
  const archiveDirectory = process.env.PACKAGE_TARBALL_DIR;
  if (archiveDirectory) {
    const archives = (await fs.readdir(archiveDirectory)).filter((name) =>
      name.endsWith(".tgz"),
    );
    assert.equal(archives.length, 1, "Expected exactly one candidate tarball");
    process.env.PACKAGE_TARBALL = path.resolve(archiveDirectory, archives[0]);
  }
  const tarball = process.env.PACKAGE_TARBALL
    ? path.resolve(process.env.PACKAGE_TARBALL)
    : path.join(
        temporary,
        JSON.parse(
          (
            await npm(
              ["pack", "--json", "--pack-destination", temporary],
              repository,
            )
          ).stdout,
        )[0].filename,
      );
  const installation = path.join(temporary, "installation");
  await fs.mkdir(installation);
  await npm(
    [
      "install",
      "--prefix",
      installation,
      "--omit=dev",
      "--no-audit",
      "--no-fund",
      tarball,
    ],
    temporary,
  );
  const installed = path.join(installation, "node_modules", "repo-control");
  await assert.rejects(
    fs.access(path.join(installed, "apps", "server", "src")),
    "The installed package must not rely on server sources.",
  );
  const metadata = JSON.parse(
    await fs.readFile(path.join(installed, "package.json"), "utf8"),
  );
  const workspace = await createDemoWorkspace(
    path.join(temporary, "Alex's Projects & café"),
  );
  const shim = path.join(
    installation,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "repo-control.cmd" : "repo-control",
  );
  const port = await availablePort();
  base = `http://127.0.0.1:${port}`;
  const args = [workspace, "--port", String(port), "--no-open"];
  if (process.platform === "win32") {
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    child = spawn(
      "powershell.exe",
      ["-NoProfile", "-Command", `& ${[shim, ...args].map(quote).join(" ")}`],
      { cwd: installation, env },
    );
    // Exercise cmd.exe's actual npm shim as well as the PowerShell launch above.
    const version = await new Promise((resolve, reject) => {
      const cmd = spawn(
        "cmd.exe",
        ["/d", "/s", "/c", `""${shim}" --version"`],
        { env, windowsVerbatimArguments: true },
      );
      let text = "";
      cmd.stdout.on("data", (chunk) => {
        text += chunk;
      });
      cmd.once("error", reject);
      cmd.once("close", (code) =>
        code === 0
          ? resolve(text.trim())
          : reject(new Error(`cmd launcher exited ${code}`)),
      );
    });
    assert.equal(version, metadata.version);
  } else child = spawn(shim, args, { cwd: installation, env });
  child.on("error", (error) => {
    output += error.stack;
  });
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null)
      throw new Error(`CLI exited ${child.exitCode}: ${output}`);
    try {
      const health = await fetch(`${base}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (health.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Waiting for this isolated process only. */
    }
    await delay(250);
  }
  assert.ok(ready, `Packaged CLI did not start: ${output}`);
  const health = await api("health");
  assert.equal(health.root, workspace);
  const { projects } = await api("projects");
  assert.equal(projects.length, 7);
  assert.equal(
    projects.find((project) => project.name === "documentation").behind,
    1,
  );
  assert.equal(
    projects.find((project) => project.name === "design-system").ahead,
    1,
  );
  const html = await (await fetch(base)).text();
  assert.match(html, /<div id="root">/);
  const asset = html.match(/src="([^"]+\.js)"/)[1];
  const assetResponse = await fetch(new URL(asset, base));
  assert.equal(assetResponse.status, 200);
  assert.match(assetResponse.headers.get("content-type"), /javascript/);
  assert.equal((await api("setup")).completed, false);
  const project = projects.find((item) => item.name === "atlas-api");
  const command = await api(`projects/${project.id}/terminal/run`, {
    command: 'node -p "process.cwd()"',
  });
  assert.equal(command.ok, true, command.output);
  assert.equal(
    await canonicalPath(command.output),
    await canonicalPath(project.path),
  );
  const failure = await api(`projects/${project.id}/terminal/run`, {
    command: 'node -e "process.exit(7)"',
  });
  assert.equal(failure.exitCode, 7, failure.output);
  const pending = api(`projects/${project.id}/terminal/run`, {
    command: 'node -e "setInterval(()=>{},1000)"',
  });
  await delay(800);
  await api(`projects/${project.id}/terminal/cancel`, {});
  assert.equal((await pending).ok, false);

  const mcp = await mcpStdioSession(path.join(installed, "bin", "repo-control.mjs"), workspace);
  assert.equal(mcp.initialized.serverInfo.name, "repo-control");
  assert.equal(mcp.initialized.serverInfo.version, metadata.version);
  assert.ok(mcp.tools.includes("list_repositories"), mcp.tools.join(", "));
  assert.ok(!mcp.tools.includes("git_push"), "repo-control mcp is read-only without --allow-writes");
  assert.match(mcp.listed.content[0].text, /^7 of 7 repositories\./);
  assert.match(mcp.stderr, /MCP server ready on stdio/);

  if (process.argv.includes("--browser")) {
    const { chromium } = await import("@playwright/test");
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await page
      .getByRole("dialog", { name: "Welcome to your workspace" })
      .waitFor();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByText("Only Git is required.", { exact: false }).waitFor();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("button", { name: "Open repository", exact: true })
      .click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert.equal((await api("setup")).completed, true);
    await page.reload();
    await page
      .getByRole("textbox", { name: "Open repository search, shortcut Ctrl+P" })
      .waitFor();
    assert.equal(
      await page
        .getByRole("dialog", { name: "Welcome to your workspace" })
        .count(),
      0,
    );
    assert.deepEqual(errors, []);
    await browser.close();
    browser = undefined;
  }
  console.log(
    `PASS: installed repo-control@${metadata.version} on ${process.platform}; CLI, assets, Git fixtures, terminal exit/cancel, MCP stdio${process.argv.includes("--browser") ? ", browser onboarding" : ""}.`,
  );
} catch (error) {
  console.error(output);
  throw error;
} finally {
  await browser?.close();
  await stop();
  await fs.rm(temporary, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 200,
  });
}
