#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The engines field only warns on a normal install, and `npm install --ignore-scripts`
// skips the preinstall check entirely, so the binary repeats it. An unsupported Node is
// the most likely first-run failure and deserves a real message rather than a stack trace.
const [major, minor] = process.versions.node.split(".").map(Number);
const nodeSupported = (major === 20 && minor >= 19) || (major === 22 && minor >= 13) || major >= 24;

if (!nodeSupported) {
  console.error(`\nrepo-control cannot run with Node.js ${process.versions.node}.`);
  console.error("Use Node.js 20.19+, 22.13+, or 24+ (Node 24 recommended).\n");
  process.exit(1);
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));

const HELP = `
  repo-control ${packageJson.version}
  Local-first command center for multi-repository workspaces.

  Usage
    $ repo-control [workspace] [options]

  Arguments
    workspace            Folder scanned recursively for Git repositories.
                         Defaults to the current directory.

  Options
    -p, --port <port>    Port to listen on (default 3747).
        --host <host>    Address to bind (default 127.0.0.1).
        --no-open        Do not open the dashboard in a browser.
    -v, --version        Print the version and exit.
    -h, --help           Show this help and exit.

  Examples
    $ repo-control
    $ repo-control ~/projects
    $ repo-control ~/work --port 4000 --no-open

  repo-control runs Git, Docker and terminal commands on this machine and has no
  authentication layer. Keep it bound to a loopback address.
`;

function parseArguments(argv) {
  const options = { root: null, port: null, host: null, open: true };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case "-h":
      case "--help":
        return { ...options, help: true };
      case "-v":
      case "--version":
        return { ...options, version: true };
      case "--no-open":
        options.open = false;
        break;
      case "-p":
      case "--port":
        options.port = argv[++index];
        break;
      case "--host":
        options.host = argv[++index];
        break;
      default: {
        if (argument.startsWith("-")) {
          console.error(`Unknown option: ${argument}\nRun "repo-control --help" for usage.`);
          process.exit(1);
        }

        if (options.root !== null) {
          console.error(`Unexpected argument: ${argument}\nRun "repo-control --help" for usage.`);
          process.exit(1);
        }

        options.root = argument;
      }
    }
  }

  return options;
}

// Best effort only: a machine with no graphical browser (a container, a bare SSH session)
// is a normal way to run repo-control, and failing to open one must never fail the launch.
function openBrowser(url) {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];

  try {
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    // Ignored on purpose - the banner already prints the URL.
  }
}

const options = parseArguments(process.argv.slice(2));

if (options.help) {
  console.log(HELP);
  process.exit(0);
}

if (options.version) {
  console.log(packageJson.version);
  process.exit(0);
}

if (options.port !== null) {
  const port = Number(options.port);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Invalid port: ${options.port}`);
    process.exit(1);
  }

  process.env.PORT = String(port);
}

if (options.host !== null) {
  process.env.HOST = options.host;
}

// The workspace has to be resolved and exported before the server module is imported: the
// env schema captures process.cwd() as REPO_CONTROL_ROOT's default when it is constructed.
process.env.REPO_CONTROL_ROOT = path.resolve(options.root ?? process.env.REPO_CONTROL_ROOT ?? process.cwd());

// This process serves the built dashboard; there is no Vite dev server in an install.
process.env.REPO_CONTROL_SERVE_WEB = "1";

// server.js, not index.js: index.js is the standalone entry that starts the server on
// import, while server.js is the module that exports startServer for a caller to invoke.
const { startServer } = await import(
  pathToFileURL(path.join(packageRoot, "dist", "server", "server.js")).href
);

try {
  await startServer();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  if (error?.code === "EADDRINUSE") {
    console.error(`\nPort ${process.env.PORT ?? 3747} is already in use.`);
    console.error("Stop the other process or start repo-control with --port <port>.\n");
    process.exit(1);
  }

  console.error(`\nrepo-control failed to start: ${message}\n`);
  process.exit(1);
}

if (options.open) {
  const host = process.env.HOST === "127.0.0.1" || !process.env.HOST ? "localhost" : process.env.HOST;
  openBrowser(`http://${host}:${process.env.PORT ?? 3747}`);
}
