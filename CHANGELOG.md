# Changelog

All notable changes to repo-control will be documented in this file.

This project follows semantic versioning where practical.

## Unreleased

## [0.9.0] - 2026-08-29

### Security

- Validate the `Host` header on every API request and reject anything that is not a loopback name or the configured bind host. Binding to `127.0.0.1` does not keep browsers out: a page on any origin can re-resolve its own hostname to loopback, at which point the browser treats API calls as same-origin and neither CORS nor the origin allowlist applies. The check runs before routing, so a rebound request cannot widen the workspace root, enumerate repositories or start a terminal command. `ALLOWED_HOSTS` accepts additional hostnames.

### Added

- Translate the entire interface. Every user-facing surface now follows the language toggle in both English and Italian: Automation, Task engineering, Git changes, Terminal, Branches, Docker, the repository catalog, Favorites, the command palette and Agent sessions. Previously only the application shell was translated, so the toggle changed the navigation and left the working surfaces in Italian.
- Add contribution scaffolding: CODEOWNERS marking the trust-boundary paths, a pull request template that asks for an explicit note when a change touches command execution or path resolution, and issue forms that route security reports to the private process instead of a public issue.

### Changed

- Separate display language from identity in workflow and task data. Node groups, workflow validation issues, task phases and run statuses are now stable identifiers resolved through the active locale, rather than Italian strings used as both label and key.
- Format every date, relative timestamp and duration with the active interface language instead of a hardcoded `it-IT` locale or the browser default.
- Run the CI matrix once per pull request. An unfiltered `push` trigger alongside `pull_request` ran the full three-version matrix and the browser suite twice for every commit on a branch with an open pull request.

### Fixed

- Release the workflow reservation before publishing a run's terminal status. The reservation was released after the status was already visible, so starting a new run immediately after watching one finish could be refused with "already has a run in progress".
- Recover from favorite preference failures. Favorite saves are serialized with a sequence guard, rollback targets the last server-confirmed selection rather than current local state, and load, migration and save failures each surface an explicit retry.
- Clear legacy local favorites only once the server confirms the migration, so a failed migration is retried on the next load.

## [0.8.2] - 2026-08-27

### Fixed

- Surface initial workspace failures with accessible retry controls, and preserve the last successful workspace snapshot when a refresh fails.
- Keep failed repository operations visible in immediate feedback and operation history instead of losing their error context.
- Report Git details, Git activity and Docker Compose query failures in repository views, while retaining usable stale data and retrying only affected sources.
- Fall back to the workspace snapshot for repository attention signals when live Git details are unavailable, avoiding a false healthy state.

## [0.8.1] - 2026-08-24

### Changed

- Extend the Dashboard continuous flow animation to staged, modified and untracked change-concentration bars, while preserving reduced-motion behavior.

## [0.8.0] - 2026-08-24

### Added

- Add a compact operational snapshot to the Dashboard with workspace readiness, continuously animated status bars and a staged, modified and untracked change-load chart.
- Add a complete repo-control icon suite for browser tabs, installed apps, Apple devices, maskable PWA surfaces, Safari and Windows tiles.

### Changed

- Reuse the repository card grid in Favorites and share the compact or comfortable density preference with the repository catalog.
- Give every application palette its own background, surfaces, secondary colors and page chrome instead of changing only the accent color.
- Refresh the sidebar, README header and GitHub social preview with the repo-control Orbit mark.
- Remove the redundant Dashboard attention panel now that operational signals summarize the same workspace state.

### Fixed

- Correct the SVG favicon color definitions so the Orbit mark renders consistently across browsers.

## [0.7.0] - 2026-08-14

### Added

- Add a repository Panoramica with attention signals, Git/Docker health, recent commits and contextual quick actions.
- Add per-file staged, unstaged and untracked diff previews plus staged commit line summaries.
- Add Compose service state, health, images, published ports, per-service logs and restart controls.
- Add cancellable per-repository terminal commands while preserving the visible terminal session across tab navigation.
- Add branch search, default and merged indicators, and latest-commit metadata for local and remote branches.

### Changed

- Align the README, environment example, contributor guide, security model and architecture guide with Agent sessions, cancellable background automations, current navigation, supported configuration and local persistence.
- Replace the outdated product walkthrough with a privacy-safe synthetic demo of the current Dashboard, Git workspace, Agent sessions and automation run flow.
- Replace the duplicated repository-detail sidebar with a compact header and full-width capability tabs.
- Redesign the repository Terminal as a responsive command workbench with status-block transcripts, context, repository suggestions, session history, wrapping, copy and confirmed clearing.
- Replace the sidebar palette dropdown with a clearer Appearance control whose menu opens outside the sidebar on desktop, collapsed and mobile layouts.
- Show the repository Docker tab only when a Compose file is detected, establishing the same capability-driven rule for a future CI/CD integration.
- Rework Task Engineering around an explicit intent, review, approval-gate, implementation and verification flow with visible check output and failed-run recovery.
- Turn the global Docker view into a runtime control surface with group scope, service health, published ports and confirmed stop actions.
- Separate Favorites into a personal launchpad with empty and already-open states instead of reusing repository cards.
- Add repository sorting, folder or operational-status grouping, compact and comfortable density, and already-open indicators to the catalog.

### Removed

- Remove the non-functional Deploy placeholder from repository details.

## [0.6.0] - 2026-08-04

### Changed

- Resume agent sessions in Windows Terminal from the selected repository, using the matching WSL distribution and a login shell when the session belongs to WSL.
- Show Docker navigation, metrics and quick actions only while Docker is available, refreshing availability every minute in the background.
- Hide Task engineering from Dashboard quick actions until its workflow is redesigned.
- Raise server and web coverage gates to 80% across statements, branches, functions and lines.
- Update Fastify, Motion, Playwright, ESLint and Globals to their latest compatible minor releases.

### Fixed

- Preserve Claude tool results in conversation history and avoid surfacing whitespace-only command errors.
- Reject unsafe Windows absolute Git paths and malformed paths with repeated separators, while reporting detached HEAD reliably.
- Improve labels and interaction semantics across terminal and task-planning controls.

## [0.5.0] - 2026-07-30

### Added

- Add a unified local history for Codex, Claude Code and Gemini CLI sessions linked to workspace repositories.
- Add provider filters, recent-first ordering, detected conversation titles and one-click session resume.
- Add private local search across conversation titles and full chat content with highlighted matching snippets.

### Changed

- Open resumed agent sessions in Windows Terminal first when repo-control runs in WSL.
- Hide Task engineering from the sidebar while its future redesign is pending.

### Fixed

- Deduplicate Claude sub-agent transcripts from the main session list.

## [0.4.0] - 2026-07-30

### Added

- Add cancellable background workflow runs with live pending, running and interrupted states.
- Add run polling and cancellation APIs, plus live progress and cancellation controls in the automation workspace.
- Add startup recovery for workflow runs interrupted by an application restart.

### Changed

- Return accepted workflow runs immediately and persist step results as background execution progresses.
- Prevent the same workflow from starting more than one active run at a time.
- Remove the duplicate version label from the palette control in the sidebar.

### Fixed

- Terminate complete command process groups on cancellation or timeout, including commands that leave background descendants running.
- Preserve incomplete workflow timestamps and status details while normalizing persisted run history.

### Removed

- Remove the superseded task-engineering workspace design draft.

## [0.3.0] - 2026-07-24

### Added

- Add workflow readiness checks, actionable configuration feedback and protection against losing unsaved automation edits.
- Distinguish successful runs from runs completed with skipped steps through a dedicated warning state.
- Add a lazily loaded Motion-powered grid backdrop shared across every application section with reduced-motion support.
- Replace the binary light/dark toggle with persistent White, Black, Red, Blue and Green application palettes.

### Changed

- Rework the automation workspace around a viewport-filling, scroll-free canvas with n8n-inspired Editor and Executions views, a searchable node library and an on-demand node inspector.
- Simplify the shared animated backdrop to a single lightweight sweep without an anchored ambient glow.
- Stop downstream workflow nodes after the first failed action while still collecting the result for every selected repository in the active step.

### Fixed

- Prevent disconnected canvas nodes from being executed outside the visible workflow chain.
- Serialize local workflow and run-history mutations to avoid lost updates during concurrent operations.

## [0.2.1] - 2026-07-23

### Added

- Add reusable text-input nodes to visual automations, with required/default values and per-run prompts for previews and executions.
- Allow terminal nodes to consume runtime values through safe `{{inputs.key}}` environment references.

### Changed

- Upgrade Fastify and its CORS plugin together to their compatible v5/v11 releases.
- Move Material UI and Material Icons from unsupported v5 releases to the supported v7 line, including the React 18 compatibility override recommended by MUI.
- Keep Dependabot focused on low-risk minor and patch updates; major upgrades now require an explicit migration plan.

### Security

- Remove the production dependency vulnerabilities reported by `npm audit` through the coordinated Fastify migration.

## [0.2.0] - 2026-07-22

### Added

- Add repository-aware task planning through Claude Code, including selectable planning depth, clarification questions, editable review and explicit approval before implementation.
- Persist planning provenance, assumptions and safe verification commands with approved engineering tasks.
- Add cancellation support for active planning and command execution.
- Add Node.js runtime guards and a WSL-friendly startup script that loads `nvm` before launching repo-control.
- Add automated quality gates with linting, strict TypeScript checks, coverage thresholds and Playwright browser flows across Node.js 20, 22 and 24.
- Add a privacy-safe product walkthrough and a dedicated social preview asset.

### Changed

- Reframe the project documentation around the multi-repository workflow problem, architectural boundaries and safety model.
- Replace the manual task creation dialog with a brief-to-plan workflow that keeps repository context read-only during planning.
- Remove the external API Ninjas integration and keep dashboard quotes bundled locally.

### Fixed

- Close the repository command palette reliably after navigation.
- Propagate cancellation signals through Claude Code and engineering command runners.

## [0.1.11] - 2026-07-15

### Fixed

- Close the repository search overlay immediately after selecting a project without reopening it during focus restoration.
- Preserve keyboard access to repository search through Enter, Space, Escape and Ctrl+P.

## [0.1.10] - 2026-07-15

### Added

- Add an operational Dashboard with live workspace metrics, Git health charts, local change distribution and recent commit activity.
- Add direct repository navigation from Dashboard insights and a lightweight animated technical backdrop with reduced-motion support.

### Changed

- Replace the oversized quote area with a compact rotating quote panel and correctly anchored navigation tooltip.
- Improve repository scanning, per-project summary refreshes, query caching and rendering of large Git workspaces.
- Lazy-load heavy application sections, keep only recently used repository panels warm and reduce initial font and stylesheet loading.

## [0.1.9] - 2026-07-14

### Added

- Add a visual automation workspace with workflow editing, dry runs, execution history and reusable Git, Docker and terminal nodes.
- Add multi-repository context selection to Task engineering.
- Add a Dashboard home with bundled rotating quotes and quick navigation actions.
- Add application-level tabs for every open repository, including keyboard navigation and independent close actions.

### Changed

- Move repository details out of the modal and into the main application workspace.
- Reorganize frontend API clients and types by domain, and split backend Brain and workflow concerns into focused modules.
- Add ESLint, React Hooks validation, architecture documentation and a unified `npm run check` quality gate.

## [0.1.8] - 2026-07-01

### Added

- Add per-file stage and unstage actions in the project Git tab.
- Add Git stash creation, stash listing and stash pop from the project Git tab.
- Add Git activity pagination in the project detail modal.

### Changed

- Rework the project detail modal layout around focused Git, Branches, Terminal, Docker and Deploy tabs.
- Keep the terminal command input focused after running a command.
- Remove shared command output notifications from project detail tabs.

## [0.1.7] - 2026-06-30

### Added

- Add a Docker control center that groups running containers by Compose project.
- Add a stop action for Docker Compose groups from the dashboard.
- Add collapsible repository sections for favorites and workspace groups.

### Changed

- Move the workspace picker into the top toolbar next to the command palette.
- Replace the toolbar image logo with a compact gradient text wordmark.

## [0.1.6] - 2026-06-30

### Added

- Allow toggling repository favorites from the project detail modal.

### Changed

- Make the update button more visible when a newer release is available.
- Focus the command palette search input immediately when opening it from the top search bar.
- Replace noisy server request logs with an ASCII startup banner and error-only API logging.
- Stop tracking `package-lock.json` so local `npm install` runs do not create noisy diffs.

## [0.1.5] - 2026-06-30

### Added

- Poll for newer release tags every 5 minutes and enable the in-app update button only when a newer release is available.
- Persist favorite repositories in a local machine preferences file outside Git.

### Changed

- Adapt VS Code launchers and terminal commands to the current runtime environment, including Windows PowerShell installs.

## [0.1.4] - 2026-06-29

### Added

- repo-control banner shown in the app bar.

### Changed

- Use the modern Windows folder picker for workspace selection.

### Fixed

- Corrected icon dimensions in the projects dashboard.

## [0.1.3] - 2026-06-29

### Changed

- Refactored the frontend into focused modules and reusable dashboard/project components.
- Reworked the workspace selector into a central click-only picker bar with no manual path editing.
- Centered and widened repository search for faster filtering from the main dashboard.

## [0.1.2] - 2026-06-29

### Added

- In-app update button near the visible version.
- Self-update endpoint that runs `git pull --ff-only`, `npm install` and schedules a local server restart.
- Update output dialog with success and blocked-update feedback.

## [0.1.1] - 2026-06-29

### Added

- Native workspace folder picker from the web UI.
- WSL/Windows path conversion for selected folders.

## [0.1.0] - 2026-06-29

### Added

- Local dashboard for discovering Git repositories under a workspace folder.
- Workspace map and table views.
- Project detail overlay with multi-project tabs.
- Changes tab with grouped file status, stage all, unstage all, commit and push.
- Branches tab with local and remote branches, ahead/behind, checkout, create branch, fetch and pull ff-only.
- Docker Compose up and rebuild actions.
- Local terminal command runner scoped to the selected project.
- Open-in-VS-Code action with launcher detection for common local setups.
- Dark mode toggle.
- Public project docs, MIT license, security notes and contributor guidelines.
