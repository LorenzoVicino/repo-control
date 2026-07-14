# Architecture

repo-control is a local-first TypeScript application with a Fastify API and a React client.
Code is grouped by runtime first, then by domain or responsibility.

## Server

```text
apps/server/src/
  config/       environment parsing and runtime configuration
  lib/          infrastructure helpers with no domain ownership
  routes/       HTTP schemas, request validation and response mapping
  services/     application use cases and integrations
    brain/      Task engineering contracts and persistence helpers
    workflow/   Workflow contracts, normalization and persistence
```

Routes should stay thin: validate input, call a service and translate expected errors to HTTP responses.
Services own application behavior. File persistence, normalization and compatibility code belong in a
domain subdirectory rather than in the service orchestrator.

## Web

```text
apps/web/src/
  api/          API clients split by domain; http.ts owns shared transport behavior
  components/   UI grouped by feature (automation, dashboard, project, task)
    shared/     reusable presentation components with no feature ownership
  types/        API and UI contracts split by domain
  utils/        pure cross-feature helpers
```

Feature components import their own API module and domain types directly. Avoid adding a global API
client or type barrel: explicit imports keep dependencies visible and prevent unrelated features from
becoming coupled.

Large pages should orchestrate data and navigation. Extract independent panels, dialogs and pure domain
logic once they have their own state, props or testable behavior.

## Dependency direction

- Web components may depend on `api`, `types` and `utils`.
- API modules may depend on `api/http.ts` and domain types, never on components.
- Server routes may depend on services and `lib` contracts.
- Services may depend on domain helpers and infrastructure, never on routes.
- Domain normalization and persistence modules should not import HTTP or UI code.

## Quality gates

Run the following before sharing a change:

```bash
npm run check
npm run build
```

`check` runs ESLint, React Hooks validation and the strict TypeScript compiler.
