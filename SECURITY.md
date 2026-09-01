# Security

repo-control is designed for a single trusted user on a local developer workstation. It is not a multi-user service and it has no user accounts, roles or authorization model.

An optional sign-in exists for one case: keeping the person in front of a shared, screen-shared or unlocked machine out of your workspace. Set `REPO_CONTROL_AUTH_USERNAME` and `REPO_CONTROL_AUTH_PASSWORD` (both, or the server refuses to start) and every `/api` route except sign-in and health requires a session cookie. It is a single credential pair read from the environment, over plain HTTP on loopback, with sessions held in process memory - it does not make the API safe to expose beyond the local machine.

The API and Vite development server bind to `127.0.0.1` by default. Keep both on localhost. Changing the bind address exposes an API that can run Git, Docker and terminal commands; CORS is not an authentication boundary.

Binding to loopback alone does not keep browsers out. A page on any origin can re-resolve its own hostname to `127.0.0.1` (DNS rebinding); the browser then treats requests to the API as same-origin, so CORS never runs and the origin allowlist is not consulted. The API therefore validates the `Host` header on every request and rejects anything that is not a loopback name or the configured bind host with `403 FORBIDDEN_HOST`. Set `ALLOWED_HOSTS` (comma-separated) if you reach the API through another hostname.

## Supported trust boundary

- Bind to `127.0.0.1`.
- Use a workspace folder that only contains repositories and nested directories you intend repo-control to scan and operate.
- Run the app and its local CLI integrations as a non-privileged user.
- Review terminal commands and workflow definitions before execution.
- Keep `.env`, the repo-control configuration directory and AI-agent history directories readable only by the intended local user.
- Add a separate authentication and authorization layer before any use beyond the local machine. The built-in sign-in is not that layer.

## Local sensitive data

Depending on the features used, repo-control stores favorites, terminal command history, workflow definitions, workflow step output and legacy task records in its local configuration directory. The default path is `%APPDATA%\repo-control` on Windows, `~/Library/Application Support/repo-control` on macOS and `${XDG_CONFIG_HOME:-~/.config}/repo-control` on Linux/WSL. `REPO_CONTROL_CONFIG_DIR` overrides it.

The Agent sessions page reads existing Codex, Claude Code and Gemini CLI histories to build workspace-scoped results and content-search snippets. repo-control does not copy those transcripts into its own configuration directory, but anyone able to access the running local API can query the indexed content visible to the app.

Command arguments, command output and agent transcript snippets may contain secrets or private source material. Do not publish local configuration files, E2E artifacts, screenshots or logs without reviewing them.

## Execution safeguards and limits

- The `Host` header is validated before routing, so a rebound request is rejected before it can resolve a project or start a command.
- When credentials are configured, the sign-in check also runs before routing: an unauthenticated caller cannot resolve a project or start a command. Session cookies are `HttpOnly` and `SameSite=Strict`, credentials are compared in constant time, and repeated failures pause sign-in briefly.
- Project endpoints resolve an opaque project identifier against repositories discovered under the active workspace.
- Git ref and file-path inputs are validated; pull is fast-forward-only and branch changes are blocked on dirty repositories.
- Docker Compose actions require a Compose file in the selected repository.
- Invalid or disconnected workflow graphs are rejected, and failed actions stop downstream steps.
- Agent session resume validates that the session belongs to the requested discovered repository before opening a terminal.

These controls reduce accidental misuse; they are not a sandbox. A terminal command, workflow node, Git hook, Docker configuration or resumed external agent can still execute code with the permissions of the repo-control process.

## Reporting issues

If you find a security issue, contact the project maintainers privately before opening a public issue. Include the affected version, reproduction steps, impact and any suggested mitigation, but do not include real credentials or private repository content.
