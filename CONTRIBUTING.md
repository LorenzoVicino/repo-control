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
npm run typecheck
npm run build
```

## Guidelines

- Keep the API bound to localhost by default.
- Do not commit personal paths, tokens, customer names or machine-specific settings.
- Prefer explicit Git actions over broad shell commands.
- Treat destructive actions, such as discarding files, deleting branches or force pushing, as opt-in flows.
