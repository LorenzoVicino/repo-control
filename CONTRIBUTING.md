# Contributing

repo-control is a local developer tool. Keep changes focused, local-first and safe by default.

## Local setup

```bash
npm install
npm run dev
```

Open <http://127.0.0.1:5173>.

## Before sharing changes

```bash
npm run verify
npm run test:e2e
```

These commands run linting, strict TypeScript checks, server and React tests with coverage thresholds, the production build, and the critical browser flows through Chromium.

## Guidelines

- Keep the API bound to localhost by default.
- Do not commit personal paths, tokens, customer names or machine-specific settings.
- Prefer explicit Git actions over broad shell commands.
- Treat destructive actions, such as discarding files, deleting branches or force pushing, as opt-in flows.
- Keep API clients, types and UI components grouped by domain instead of extending shared monoliths.
- Run `npm run verify` and `npm run test:e2e` before sharing code changes.
