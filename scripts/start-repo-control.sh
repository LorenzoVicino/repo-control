#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # Non-interactive WSL login shells return from .bashrc before nvm is loaded.
  # Load it here so Windows launchers do not fall back to /usr/bin/node.
  # shellcheck source=/dev/null
  source "$NVM_DIR/nvm.sh"
  nvm use --silent default >/dev/null 2>&1 || true
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js was not found. Install Node.js 24 with nvm, then try again." >&2
  exit 1
fi

node scripts/check-node-version.cjs

echo "Using Node.js $(node --version) ($(command -v node))"
npm install
exec npm run dev
