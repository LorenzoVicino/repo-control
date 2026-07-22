"use strict";

var version = process.versions.node.split(".").map(Number);
var major = version[0];
var minor = version[1];
var supported =
  (major === 20 && minor >= 19) ||
  (major === 22 && minor >= 13) ||
  major >= 24;

if (!supported) {
  console.error("");
  console.error("repo-control cannot run with Node.js " + process.versions.node + ".");
  console.error("Use Node.js 20.19+, 22.13+, or 24+ (Node 24 recommended).");

  if (process.platform === "linux" && process.env.WSL_DISTRO_NAME) {
    console.error("");
    console.error("WSL detected. Load nvm before running npm:");
    console.error('  export NVM_DIR="$HOME/.nvm"');
    console.error('  . "$NVM_DIR/nvm.sh"');
    console.error("  nvm use 24");
  }

  process.exit(1);
}
