# Contributing

repo-control is a local developer tool. Keep changes focused, local-first and safe by default.

## Requirements

- Git
- Node.js 20.19+, 22.13+ or 24+ (Node 24 recommended)
- The npm version is pinned in `package.json` under `packageManager`. CI installs exactly that
  version; match it locally with `npm install -g npm@<version>` before regenerating the
  lockfile. Different npm versions can write lockfiles the others refuse to install, which is
  a confusing failure to debug from a red CI job.
- Chromium installed through Playwright when running the browser suite

## Local setup

```bash
npm ci
npm run dev
```

Open <http://127.0.0.1:5173>. The API listens on <http://127.0.0.1:3747> by default. Copy `.env.example` to `.env` to configure the server locally; never commit `.env`.

The default workspace is the repository root. Set `REPO_CONTROL_ROOT` or use the workspace picker when you need representative multi-repository data.

## Tests and quality gates

Useful focused commands are:

```bash
npm run lint
npm run typecheck
npm run test:server
npm run test:web
```

Before sharing a change, run the complete gate:

```bash
npm run verify
npx playwright install chromium
npm run test:e2e
```

`verify` runs linting, strict TypeScript checks, server and React tests with 80% coverage thresholds, and the production build. `test:e2e` starts the real API and Vite server and exercises critical browser-to-API flows through Chromium.

CI runs `verify` on Node.js 20.19, 22.13 and 24. The browser job runs after that matrix succeeds.

## Guidelines

- Keep the API bound to localhost by default.
- Do not commit personal paths, tokens, customer names or machine-specific settings.
- Prefer explicit Git actions over broad shell commands.
- Treat destructive actions, such as discarding files, deleting branches or force pushing, as opt-in flows.
- Keep API clients, types and UI components grouped by domain instead of extending shared monoliths.
- Resolve project paths on the server from project identifiers; do not accept arbitrary command working directories from the browser.
- Treat agent transcripts, terminal history and workflow output as private local data in code, fixtures and screenshots.
- Update the README, architecture guide, `.env.example` and changelog when a change affects public behavior, configuration, persistence or supported tooling.

See [Architecture](docs/architecture.md) for dependency direction and placement conventions, and [Security](SECURITY.md) for the supported trust boundary.
