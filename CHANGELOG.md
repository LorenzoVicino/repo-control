# Changelog

All notable changes to repo-control will be documented in this file.

This project follows semantic versioning where practical.

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
