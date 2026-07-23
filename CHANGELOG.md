# Changelog

All notable changes to repo-control will be documented in this file.

This project follows semantic versioning where practical.

## Unreleased

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
