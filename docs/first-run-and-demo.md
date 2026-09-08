# First run, demo and installed-package verification

Native Windows is the primary onboarding target. Node.js and Git are required; WSL,
Docker, VS Code and agent CLIs are optional.

## Local setup

New configurations receive a three-step setup dialog: confirm a folder, check tools,
and open a repository. A configuration directory containing preferences, command history,
workflows or earlier task data identifies an existing installation and receives an
invitation. Setup can be skipped or reopened from Settings. Completing or skipping saves
`onboardingVersion: 1` in the existing preferences document without replacing favorites
or layout.

`GET /api/setup` reports completion. Entering the tools step calls
`GET /api/setup/tools`, so completed users do not pay for detection during normal startup.
Agent executables are checked on PATH without launching them or reading their transcripts.
Docker availability includes a bounded daemon probe. `PUT /api/setup` accepts
`{ "version": 1 }`; all setup routes use the application's existing authentication gate.

## Reproducible local workspace

```sh
npm run demo:workspace
# Or provide a new directory whose parent exists:
npm run demo:workspace -- "C:\Users\Alex\repo-control-demo"
```

The script prints the workspace path and launch command. It refuses an existing target.
Repositories and local bare remotes live under that new directory; no real remotes,
credentials, agent histories or Docker processes are used. Fixtures cover clean,
modified, staged, untracked, ahead and behind states. Fixed author identities and dates
keep generated history reproducible. Remove the generated directory when finished.

## Online demo

```sh
npm run dev:demo
npm run build:demo
npm run test:demo
```

The demo uses the same UI with a dedicated API transport, selected at build time by
Vite's `demo` mode. Every request terminates in the adapter; unknown actions return an
explicit local-only error. Demo code is omitted from regular production builds.

State lasts for the current page session. Reload or Reset demo restores the fictional
workspace; interface preferences such as palette retain their normal browser persistence.
Supported mutations include staging, unstaging, committing and syncing. The sample fetch
workflow supports preview, simulated execution and cancellation. Workflow editing, real
shell commands, folder picking, opening editors and resuming agents require the local app.
The terminal demonstrates `pwd`, `git status` and `git log --oneline -5` only.

`fixtures/demo-scenarios.json` supplies the repository scenarios to both the browser
adapter and the real Git generator. Container and conversation data are fictional.

The static build is `dist/demo`, with `/repo-control/` as its default base. Set
`DEMO_BASE_PATH=/` for a dedicated domain. The Online demo workflow builds and checks PRs;
main pushes publish through GitHub Pages. In repository Settings → Pages, select
GitHub Actions as the source before the first deployment. Expected URL:
https://lorenzovicino.github.io/repo-control/.

## Installed package checks

```sh
npm run build
npm run test:package -- --browser
```

The check packs the application, installs it into a temporary directory with production
dependencies, and launches the installed CLI from outside the checkout. It validates
the actual served HTML and JavaScript, discovered Git states, terminal working directory,
exit status and cancellation. With `--browser`, Chromium completes onboarding and checks
that completion survives reload. Temporary data and child processes are cleaned up.

CI packs once, then installs that same artifact on Windows (all declared Node lines),
Linux and macOS. Windows and Linux run the browser check on Node 24. Release publishing
depends on this matrix and publishes the tested tarball. Run the broader `npm run verify`
gate before preparing a release as usual.

## Desktop release checks

Hosted CI does not establish that graphical integrations work on a user's desktop.
Before a Windows release, check Windows 11 with PowerShell and Command Prompt: npx launch,
automatic browser opening, folder selection/cancellation, a path containing spaces and
Unicode, VS Code launch, Windows Terminal resume and fallback when an optional tool is
absent. Separately check WSL-to-Windows folder and terminal integration. On macOS, check
Finder selection and Terminal launch. Record the OS, shell and result in the release PR.
