# Product

<!-- impeccable:product-schema 1 -->

All facts below are inferred from the repository's own documentation (`README.md`,
`docs/architecture.md`, `docs/design-agent-prompts/00-master-brief.md`) and from the
running code. No interview took place; the dashboard redesign brief that created this
file asked for autonomous decisions. Items marked *(inferred)* were not confirmed by a
person and should be corrected where they are wrong.

## Platform

web

## Users

A developer or tech lead who manages roughly 5 to 50 Git repositories on one machine,
works with keyboard and mouse, and moves all day between Git, a terminal, Docker and
local AI coding agents (Codex, Claude Code, Gemini CLI). They are competent and want
less context switching, not fewer facts. The tool is personal: one person, one
workspace folder, one browser tab, usually open for hours beside an editor and a
terminal. *(inferred from the master brief)*

## Product Purpose

repo-control turns one workspace folder into a live operational view of every Git
repository inside it: what is clean, what is drifting, what needs attention and which
action is safe to run next. It exists so that routine multi-repository work stops
requiring a folder hunt, a fresh terminal and a rebuilt mental context before every
command. Success is a developer who opens repo-control, knows within seconds what needs
them, and resumes the right repository, container or agent conversation in one click.

## Positioning

Local-first and boundary-scoped: the API binds to localhost, resolves project
identifiers server-side and only ever runs commands inside repositories it discovered.
It reads real Git, Docker and agent-CLI state rather than simulating a project view,
and it is the one place where Codex, Claude Code and Gemini CLI histories can be
searched and resumed together. No cloud, no team feed, no vanity analytics.

## Operating Context

- Started with `npx repo-control <folder>`; the dashboard is served from the same
  localhost port as the API and opens in a browser.
- Repositories are discovered recursively; the workspace can be changed from the UI
  (folder picker, `Ctrl+O`). `Ctrl+P` opens a repository command palette.
- Sections: Dashboard, Repositories (map or table), Favorites, Docker runtime (only when
  the Docker CLI is present), Agent sessions, Automations, Settings. Repository
  workspaces open as persistent tabs with Overview, Changes, Branches, Terminal and
  Docker panels.
- Docker and VS Code are optional local tools; the interface adapts when they are absent.
- Preferences: favourites are stored server-side in `preferences.json` under the
  config directory; palette, text size and language are browser local storage.
- Quality gates: ESLint, strict TypeScript, server and React tests with 80% coverage
  thresholds, Playwright browser flows; CI on Node.js 20, 22 and 24.

## Capabilities and Constraints

- Git: per-repository summary (branch, staged/modified/untracked counts, ahead/behind,
  upstream, last commit), details, diffs, staging, commits, stashes, fetch/pull/push,
  branches with safe checkout.
- Docker: workspace-wide container list grouped by Compose project (running containers
  only, with a status string carrying health), per-container stats, exec and log
  sessions; per-repository Compose services, ports, logs, restart and stack actions.
- Agent sessions: workspace-scoped list and search of local Codex, Claude Code and
  Gemini CLI conversations with title, preview, repository, branch and timestamps;
  resume opens a native terminal.
- Automations: visual workflow definitions, dry runs, background runs with statuses
  `pending`, `running`, `success`, `warning`, `failed`, `cancelled`, `interrupted`;
  the latest 100 runs are kept.
- Not available today, and not to be invented: recently opened repositories are not
  tracked by the server; terminal command history is exposed only as per-repository
  suggestions; active terminal commands are not listed globally; stopped containers
  are absent from the workspace-wide Docker list.
- Task engineering exists in code but is hidden pending redesign; never present it as
  a current capability.
- Terminology: repository (not project) in the interface; workspace for the scanned
  folder; group for a Compose project in the Docker runtime view.

## Brand Commitments

- Name: repo-control, lower-case, with the SVG mark at `apps/web/public/icon/`.
- Visual direction already committed in code and in the master brief: a "precision
  workbench", sober, technical and highly legible. Neutral surfaces in three to four
  levels, borders and dividers over shadows, one accent per palette (five palettes:
  White, Black, Red, Blue, Green), a compact type scale in Inter with JetBrains Mono
  reserved for code, paths, hashes, branches and measurements. Short functional motion.
- Explicit anti-patterns from the master brief: card soup and cards inside cards,
  low-contrast glass, decorative gradients or neon, chips for every datum, vanity
  charts without an operational decision, hover as the only disclosure, mobile as a
  squeezed desktop.
- Interface languages: English and Italian, with every string in `i18n/resources.ts`.

## Evidence on Hand

- Real workspace data at runtime; demo media at `docs/repo-control-demo.gif` and
  `docs/repo-control-social-preview.png`.
- No testimonials, customer names, benchmarks or pricing exist; none may be fabricated.

## Product Principles

1. Context before action: repository, branch, directory or workflow are readable next
   to every action.
2. Risk has hierarchy: error, dirty tree, behind or diverged, active command and
   destructive action never rely on colour alone.
3. Density with calm: high information density, but with rhythm, alignment and
   progressive disclosure; the dashboard synthesises, the section pages go deep.
4. Keyboard credible: visible focus, shortcuts and controls that power users trust.
5. Local-first trust: nothing that looks like cloud collaboration or SaaS reporting.

## Accessibility & Inclusion

WCAG AA contrast, visible focus, touch targets of at least 44 px where relevant,
`prefers-reduced-motion` honoured, keyboard alternatives for every pointer interaction
(including drag and drop), and browser zoom at 200% without loss of function. *(from
the master brief)*
