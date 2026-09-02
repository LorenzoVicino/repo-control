# Changelog

All notable changes to repo-control will be documented in this file.

This project follows semantic versioning where practical.

## Unreleased

### Added

- Add an interface text size preference with three steps: **Small**, **Medium** and **Large**. The dashboard writes most of its type sizes inline rather than through the theme, so scaling only the theme would have grown the headings while leaving the small mono labels - the ones hardest to read - exactly as they were. The scale is applied to the `sx` font-size transformer instead, which reaches every inline size, the themed variants and the icon sizes beside them from one place. Panel widths are unchanged, so a larger size trades content for legibility; the setting says so. It is stored per device in browser local storage, next to the palette.

### Changed

- Redraw the workspace signals panel as a ring with the readiness figure in its hole. The four repository states are a genuine part-to-whole under the six-segment ceiling, which is the one job a circular form does better than a bar, and the percentage stops floating in its own corner of the header. The previous proportional pill also mis-drew its own data: segments were sized with `flexGrow` and separated by gaps, each carrying a 3px minimum, so a count of 1 beside a count of 40 was drawn wider than its share. Arcs are now true percentages, and a state at zero contributes no segment at all. Drawn in SVG from the existing tokens rather than with a charting library, which would have cost more than both panels are worth.
- Group the change concentration bars by file state instead of stacking them. Stacked segments could not answer the question the panel is named after - which repository has the most unstaged work - because every state started at a different offset. Each state now gets its own bar on one shared scale, that scale is the largest single state rather than the largest repository total, and it is printed under the rows. A state at zero keeps an empty track, so "nothing staged here" is readable rather than absent, and every bar carries a tooltip with its exact count.
- Stop spending the error and warning tokens on ordinary file states. `untracked` was painted `error.main` and `modified` was `warning.main`; writing a new file is not a fault, and the two alarm colors were unavailable for anything that is. staged, modified and new are a pipeline towards a commit rather than three unrelated categories, so they take one hue in three ordered steps - each palette's own `primary.light`, `main` and `dark`, which already form a valid ordered ramp in all five.
- Remove the perpetual stripe animation from both panels. Three of the four signal segments and every change bar ran a 1.1s barber-pole loop forever. A repository that needs attention is a standing fact, not a process in flight, so the motion said something untrue and competed with reading the panel it decorated.
- Rename the strictest repository signal from **Ready** to **In sync**. The ring reports `snapshot.healthy` in its hole, which is what the dashboard header already calls ready, while the signal beside it counts only repositories that are clean, synced and have nothing to push. Two different numbers labelled "ready" in one panel was survivable while they sat apart and is not now that they share a ring.
- Move the account menu from the top-right of the app bar into a **Profile** tab at the bottom of the sidebar, and give it the settings entry, the color palettes and sign-out. Reaching preferences meant hunting across three corners of the shell - settings in the sidebar navigation, palettes in a row of their own above it, sign-out behind an avatar in the opposite corner - for three things that are all "how this interface is set up for me". They now share one tab: the footer drops from three rows to two, and the palettes open as a second panel inside the same popover rather than a nested menu, so keyboard order stays inside it. The tab renders whether or not the server asks for credentials; with no session it names the local mode and withholds only the sign-out entry, because there is still a settings section to reach.
- Offer the color palettes in the settings section as well, with the same labels and descriptions the profile menu shows. The quick switch is for changing your mind; the settings page is where someone looks when they do not already know the choice exists.
- Paint each palette swatch in that palette's accent alone. The swatches were split diagonally between the palette's surface and its accent, which read as two unrelated colors per option rather than as one choice, and made the light and dark palettes hardest to tell apart at 17px.
- Hide the Task engineering section from the interface. `docs/architecture.md` has described it as hidden pending redesign for some time, but the sidebar still linked to it and the section still rendered, so an unfinished feature was the eighth thing in the navigation. The screen, its components and its server endpoints are retained for that redesign - only the entry point and the route are gone, so nothing can reach it by accident.

## [0.13.0] - 2026-09-02

### Changed

- Keep a workflow going for the repositories that are still healthy. A failing step used to skip every later node for the whole selection, so one repository without an upstream cancelled the work for all the others - and the summary node was skipped too, disappearing from exactly the run whose outcome needed reading. Failure is now tracked per repository: the one that failed is skipped by the steps that follow, the rest continue, and the summary always runs.
- Replace the `Pull develop` node with a `Pull a branch` node that takes the branch from its configuration. The old node ran `git pull origin develop`, which fails outright on git 2.34 and later whenever the branches have diverged, and merged develop into whichever branch happened to be checked out. The new node runs `git pull --ff-only origin <branch>` and skips repositories that are not on that branch, since pulling a branch into a different one is a merge nobody asked for. Workflows saved with the old node keep working: they are read back as the new node with `develop` as the branch.
- Report the outcome of a run in the summary node instead of repeating its input. It counted the repositories in the selection, which the run panel already shows; it now reports how many steps succeeded, failed and were skipped, and names the repositories that failed.
- Drop the `active` flag from workflows. It was validated, stored, returned by the API and written back unchanged by the editor, and read by nothing: neither the executor nor any screen. A persisted field that does nothing reads as a feature that is broken.

### Fixed

- Skip, rather than fail, when a Git node cannot apply to a repository. `git pull` and `git push` on a branch with no upstream reported a command failure, which under the old semantics also cancelled the rest of the run; a local-only branch is a normal state and is now reported as a skip with its reason.
- Say which tool is missing when a command cannot start. A workspace without Docker reported `spawn docker ENOENT`, which is accurate and unreadable; every command now explains that the executable was not found and can be given a path.
- Report a forked workflow graph as one mistake. Connecting two nodes to the same source reported both the fork and the nodes it left unreachable, which reads as two unrelated problems.
- Open the container console already scrolled to the newest output. `docker logs --tail` arrives as one large chunk whose newest lines are at its end, and the auto-scroll only followed the tail when the view was already near the bottom - which the first chunk never is - so the logs tab opened on the oldest line of the window and had to be scrolled by hand. Following the tail is now the starting state and is given up only when the reader scrolls away from it, and resumed when they come back.

## [0.12.0] - 2026-09-01

### Added

- Open a console on any running container from the Docker runtime page. A **Shell** tab holds a live `docker exec` session, so the working directory and environment persist between commands the way they do in Docker Desktop, and a **Logs** tab follows `docker logs` for any container - including standalone ones, which the existing Compose-scoped log route could not reach. Each row also reports live CPU, memory and I/O from `docker stats`. Sessions are long-lived docker processes with a cursor-based output buffer, capped in number, dropped after an idle period and closed with the dialog or the server. The shell is a pipe rather than a terminal, so state persists but full-screen programs do not run; the interface says so instead of leaving the user to discover it. Container IDs are revalidated against the running containers before any process starts, the shell is fixed to `bash` or `sh`, and nothing from the browser reaches a host shell.

## [0.11.0] - 2026-09-01

### Added

- Add an optional sign-in in front of the dashboard and the API. Setting `REPO_CONTROL_AUTH_USERNAME` and `REPO_CONTROL_AUTH_PASSWORD` turns on a sign-in screen and closes every `/api` route to callers without a session; leaving them unset keeps the current behaviour, so an existing install and `npx repo-control` still open straight into the workspace. Setting only one of the two is a configuration mistake that would leave an API the owner believes is protected wide open, so the server refuses to start instead. The check runs before routing, next to the `Host` check, and `/api/health` stays reachable for process supervisors while withholding the workspace root from an unauthenticated caller. Sessions are opaque tokens held in process memory and sent as an `HttpOnly`, `SameSite=Strict` cookie, lasting 12 hours or 30 days with *Remember me*; credentials are compared in constant time and five wrong answers pause sign-in for 30 seconds. A lapsed session anywhere in the interface returns to the sign-in screen rather than leaving a page of failed panels behind.
- Print the repo-control mark above the title in the startup banner. The banner already framed the URLs and workspace root, but nothing made the process identifiable at a glance in a terminal shared with the Vite dev server and whatever else is running. The mark is padded as one block so every row shares a single left indent, and a test asserts the box stays column-aligned.

### Changed

- Publish the package to npm when a GitHub release is published. Releases were tagged and published by hand, and pushing to npm was a separate manual step, so anything installing `repo-control@<version>` - the `npx` quickstart, an image built from the published package - only saw a release if someone remembered the second half. The release workflow checks out the tag rather than the default branch, refuses to publish when the tag disagrees with `package.json`, and publishes with provenance. It needs an `NPM_TOKEN` repository secret.
- Generate task plans in the language selected in the interface. The planning agent was told to write in Italian regardless of the toggle, and the plan document's own Markdown headings were hardcoded Italian, so an English interface produced an Italian plan. The web app now sends the active language with the planning and from-plan requests, and the server keeps the prompt instruction, the section headings and the approved-clarifications heading in that language.

### Fixed

- Translate the last interface strings the 0.9.0 pass missed. The repository detail panel's clean/changes chips and panel label, the workspace map and terminal panel accessibility labels, the agent-session provider filter and its local-reading notice, and the automation text-input hint were all hardcoded Italian; they now resolve through i18n in both languages. The colour palette options also carried unused Italian labels next to the translated ones, which have been dropped in favour of the i18n resources.
- Report server messages in English, matching every other message the API already returned. Docker availability errors, agent-session resume failures, native-terminal fallbacks, planning errors, the truncated-diff marker and the seeded workflow's name and description were still Italian, and the interface renders them verbatim.

## [0.10.0] - 2026-08-29

### Added

- Publish repo-control to npm as a runnable command. `npx repo-control ~/projects` installs the package, starts the API, serves the built dashboard from the same port and opens it in a browser; `--port`, `--host`, `--no-open`, `--version` and `--help` cover the rest. Trying repo-control previously meant cloning the repository and starting the Vite dev server, which is a contributor workflow rather than an install.

### Changed

- Ship only the five packages the server imports at runtime. React, MUI, Emotion, i18next, xyflow and the font packages are compiled into the dashboard bundle at build time and moved to `devDependencies`, so an install pulls 93 packages and 33 MB instead of 330 and 566 MB. `npm ci` still installs everything a checkout needs, leaving the development workflow and CI unchanged.
- Serve the built dashboard from the API process when `REPO_CONTROL_SERVE_WEB` is set, which the `repo-control` binary and `npm start` both do. Unmatched GET routes return the application shell so a refresh on a client-side route works, while `/api` misses stay JSON. The flag is opt-in rather than derived from the presence of a build, so `npm run dev` is unaffected and Vite continues to own the UI there.
- Report the address the interface is actually served from in the startup banner instead of always naming the Vite development port.

### Fixed

- Resolve repo-control's own directory from the module location rather than the working directory. The self-updater defaulted to `process.cwd()`, which is repo-control's checkout during development but the user's workspace when started through npx: checking for updates, and then `git pull --ff-only` and `npm install`, would have run against one of their repositories. An installed package has no checkout to update and now says so.

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
