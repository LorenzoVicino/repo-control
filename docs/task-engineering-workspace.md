# Task Engineering Workspace

Status: Proposed
Date: 2026-07-11
Owner: repo-control

## 1. Summary

Task Engineering Workspace is the product area used to create and deliver a new engineering task inside a repository.

It combines three capabilities in one workflow:

1. **Spec-driven development**: the task moves through explicit, revisioned specification stages and approval gates.
2. **Second brain management**: project knowledge is selected, reviewed, and attached to the task as a traceable context pack.
3. **Loop engineering**: an agent implements the approved plan in bounded iterations, runs deterministic checks, and stops on success or at a human gate.

The feature must support feature work, fixes, refactors, chores, and technical spikes without forcing every task through the same amount of ceremony.

## 2. Product Decision

The three capabilities are not separate tools. They are three layers of the same task:

```text
Task intent
   |
   v
Approved spec ---------> Context pack
   |                         |
   +------------+------------+
                |
                v
        Engineering loop
     plan -> implement -> verify
                |
        pass / retry / gate
                |
                v
       Review and brain capture
```

The primary UI is a **Task Workbench**, not a generic chat screen and not a workflow canvas.

## 3. Existing Foundations

The repository already contains useful foundations:

- `brainService.ts` persists project tasks, spec content, approvals, decisions, implementation logs, Git metadata, and a Claude session ID.
- `brainRoutes.ts` exposes task CRUD and approval gates.
- `assembleBrainContext` builds a basic context from recent tasks and decisions.
- `claudeService.ts` can inspect Claude sessions and execute a message with a permission mode.
- `workflowService.ts` runs linear repository maintenance workflows and persists run summaries.

There is also a stashed UI prototype with a task list, a phase stepper, free-text spec editors, implementation logs, decisions, Claude chat, and a workflow canvas.

### Gaps in the current model

- Task `status` currently represents both lifecycle status and current spec stage.
- Requirements, design, and breakdown are opaque Markdown strings without structured acceptance criteria or revision history.
- The second brain is derived only from recent tasks and decisions. It has no knowledge library, provenance, pinning, or review lifecycle.
- Claude execution is synchronous and cannot be paused, resumed, cancelled, or recovered after a process restart.
- There is no iteration model, check evidence, retry policy, or loop stop condition.
- The generic workflow runner has no conditional edges, durable state, or human gates. Extending it into the engineering loop would couple unrelated concepts.
- The stashed Task Wizard can advance phases, but implementation is only a manual "done" button and is not backed by verification evidence.

## 4. Goals

- Make every implementation traceable to an approved task intent and acceptance criteria.
- Give the agent only relevant, inspectable project context.
- Run implementation in finite, observable, cancellable loops.
- Require deterministic evidence before a task can be completed.
- Capture durable decisions and lessons back into the project brain.
- Support a lightweight path for small fixes and a complete path for risky features or refactors.
- Keep all task state local by default and compatible with the current repo-control configuration model.

## 5. Non-goals for V1

- Multi-user collaboration, remote synchronization, and role-based access.
- A general-purpose autonomous agent platform.
- Arbitrary workflow graph authoring for engineering loops.
- Semantic vector search or an external vector database.
- Automatic PR merge or deployment.
- Multiple agents editing the same repository concurrently.
- Supporting providers other than Claude Code in the first UI release.

The domain should still expose an agent provider interface so another provider can be added later.

## 6. Terminology

- **Task**: the durable unit of engineering work.
- **Stage**: the current step in the task delivery process.
- **Status**: the operational condition of the task, independent from its stage.
- **Spec**: the revisioned task definition, requirements, design, plan, and verification contract.
- **Brain entry**: a reusable piece of project knowledge with source and review metadata.
- **Context pack**: an immutable snapshot of brain entries and task artifacts provided to one run.
- **Run**: one execution of the approved task plan.
- **Iteration**: one agent attempt followed by deterministic verification.
- **Check**: a command or inspection with a pass/fail result and evidence.
- **Gate**: a state transition requiring validation or explicit human approval.

## 7. Task Profiles

The canonical task types are:

- `feature`
- `fix`
- `refactor`
- `chore`
- `spike`

Existing `bug` values migrate to `fix`.

Each type loads a different spec template:

| Type | Required emphasis | Default ceremony |
| --- | --- | --- |
| Feature | outcome, user behavior, acceptance criteria, rollout | Full |
| Fix | reproduction, expected behavior, root cause, regression check | Lean |
| Refactor | invariants, boundaries, migration risk, performance | Full |
| Chore | operational goal, affected systems, completion checks | Lean |
| Spike | question, time box, evidence, recommendation | Research |

Users can switch between `lean` and `full` profiles before the design gate. A lean task still has every gate, but the templates are shorter and some sections are collapsed.

## 8. Lifecycle Model

Stage and status are separate fields.

```text
Stages:
definition -> requirements -> design -> plan -> implementation -> verification -> review

Statuses:
active | blocked | paused | done | cancelled | archived
```

### Stage gates

1. **Definition gate**
   - title, type, problem, desired outcome, and scope are present.
2. **Requirements gate**
   - acceptance criteria exist and are testable.
   - non-functional requirements are present when relevant.
3. **Design gate**
   - approach, impacted areas, risks, alternatives, and decisions are recorded.
4. **Plan gate**
   - implementation steps and verification checks are defined.
   - execution mode, branch/worktree strategy, and loop limits are approved.
5. **Implementation gate**
   - the run produced a diff or an explicit no-change outcome.
6. **Verification gate**
   - every required check passed in the same iteration as the final diff.
7. **Review gate**
   - final diff summary, residual risks, and brain candidates are reviewed.

Editing an approved stage creates a new revision and invalidates approvals for that stage and every downstream stage.

The system must never silently change an approved spec.

## 9. Spec-driven Development

### Structured spec

Markdown remains available for rich notes, but important fields are structured.

```ts
type TaskSpec = {
  definition: {
    problem: string;
    outcome: string;
    motivation: string;
    inScope: string[];
    outOfScope: string[];
  };
  requirements: {
    functional: string[];
    nonFunctional: string[];
    acceptanceCriteria: AcceptanceCriterion[];
  };
  design: {
    summary: string;
    impactedAreas: string[];
    alternatives: string[];
    risks: Risk[];
    notes: string;
  };
  plan: {
    steps: PlanStep[];
    checks: VerificationCheck[];
  };
};
```

### Acceptance criteria

An acceptance criterion has a stable ID and becomes part of the verification contract.

```ts
type AcceptanceCriterion = {
  id: string;
  statement: string;
  verification: "automated" | "manual" | "inspection";
  checkIds: string[];
  required: boolean;
};
```

### Revisions and approvals

```ts
type SpecRevision = {
  revision: number;
  stage: TaskStage;
  contentHash: string;
  createdAt: string;
  createdBy: "user" | "agent";
  changeSummary: string;
};

type StageApproval = {
  stage: TaskStage;
  revision: number;
  contentHash: string;
  approvedAt: string;
  approvedBy: "user";
};
```

Approvals refer to a content hash, not only a timestamp. This prevents a stale approval from being reused after an edit.

## 10. Second Brain Management

### Knowledge model

The second brain is a project-scoped library, separate from task history.

```ts
type BrainEntryKind =
  | "architecture"
  | "convention"
  | "decision"
  | "domain"
  | "command"
  | "gotcha"
  | "reference"
  | "lesson";

type BrainEntry = {
  id: string;
  projectId: string;
  kind: BrainEntryKind;
  title: string;
  content: string;
  tags: string[];
  scope: string[];
  status: "candidate" | "approved" | "deprecated";
  source: {
    type: "manual" | "task" | "decision" | "run" | "repository" | "claude-session";
    ref: string | null;
    path: string | null;
  };
  confidence: "high" | "medium" | "low";
  createdAt: string;
  updatedAt: string;
};
```

### Context pack policy

A task context pack contains:

1. task definition and the latest approved spec revisions;
2. explicitly pinned brain entries;
3. approved entries matching task tags and impacted areas;
4. relevant recent decisions;
5. repository state: branch, status, selected files, and verification commands;
6. previous iteration failures when the run is retrying.

The context pack is previewed before a run. Every included entry displays its source. The user can pin, exclude, or replace entries.

Each run stores the exact context snapshot and its hash. Later brain edits do not mutate historical runs.

### Brain capture

After verification, the system proposes candidate entries from:

- accepted architectural decisions;
- newly discovered commands or repository conventions;
- recurring failure causes and fixes;
- implementation lessons that are reusable outside the task.

Candidates require user approval before they become reusable context. Raw agent output is never promoted automatically.

### Search in V1

V1 uses deterministic matching:

- full-text token matching;
- tags;
- entry kind;
- file/directory scope;
- recency and explicit pinning.

Semantic embeddings can be introduced later behind a `BrainSearchProvider` interface.

## 11. Loop Engineering

### Loop contract

The engineering loop is not infinite. It has an explicit budget and stop policy.

```ts
type LoopPolicy = {
  maxIterations: number;       // default 3, maximum 8
  maxDurationMinutes: number;  // default 45
  stopOnRepeatedFailure: number; // default 2 identical failures
  requireCleanRepository: boolean;
  executionMode: "worktree" | "current-branch";
  permissionMode: "plan" | "acceptEdits" | "auto";
};
```

Recommended default: an isolated Git worktree and a branch named `rc/<type>/<task-slug>`.

### Iteration state machine

```text
queued
  -> assembling-context
  -> agent-running
  -> collecting-diff
  -> checks-running
  -> evaluating
       | pass ------------------------> succeeded
       | fixable failure + budget ----> next iteration
       | repeated/unsafe failure -----> human-gate
       | cancel ----------------------> cancelled
       | timeout ---------------------> failed
```

### One iteration

1. Snapshot task spec, context pack, Git head, and repository status.
2. Build the agent prompt from the approved plan and the previous failure evidence.
3. Run the agent in the selected worktree and permission mode.
4. Capture changed files and a diff summary.
5. Execute required checks in the declared order.
6. Map check results back to acceptance criteria.
7. Decide: success, retry, or human gate.
8. Persist the complete iteration before another attempt starts.

### Retry rules

- A retry prompt includes only the approved spec, current diff, and concrete failed checks.
- The loop cannot broaden scope or rewrite acceptance criteria.
- Two identical failures without a meaningful diff stop at a human gate.
- Destructive commands, permission escalation, branch replacement, and spec changes always require a human gate.
- A cancelled run terminates the process tree and preserves all evidence gathered so far.

### Verification checks

```ts
type VerificationCheck = {
  id: string;
  name: string;
  command: string;
  cwd: string;
  required: boolean;
  timeoutMs: number;
  acceptanceCriterionIds: string[];
};

type CheckResult = VerificationCheck & {
  status: "passed" | "failed" | "skipped" | "cancelled";
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
};
```

The final task cannot reach `done` unless all required checks passed against the final Git head.

## 12. UX and Information Architecture

### Sidebar target

The application sidebar evolves from section navigation into product navigation:

```text
Workspace
  Dashboard
  Repositories

Engineering
  Tasks
  Brain
  Runs

Operations
  Docker
  Workflows
```

The first implementation can expose only Dashboard, Repositories, Tasks, Brain, and Runs. Existing repository workflows remain under Operations when their UI is restored.

### Task queue

The Tasks page is the operational inbox.

- Filters: repository, type, stage, status, owner mode, and updated date.
- Saved views: Active, Needs approval, Running, Blocked, Done.
- Dense rows show title, repository, type, stage, loop status, failed checks, and last update.
- Primary action: `New task`.

### New task flow

The creation dialog asks only for:

1. repository;
2. task type and profile;
3. title;
4. problem or desired change;
5. optional source: issue URL, pasted request, or existing branch.

After creation, the user enters the Task Workbench. The system can propose a first definition, but nothing is approved automatically.

### Task Workbench

Desktop layout:

```text
+--------------------+--------------------------------+----------------------+
| Task navigation    | Active stage                   | Context / run        |
|                    |                                |                      |
| Definition         | Structured fields + Markdown   | Context pack         |
| Requirements       | Diff from previous revision    | Brain sources        |
| Design             | Acceptance coverage            | Loop controls        |
| Plan               | Approval actions               | Checks / evidence    |
| Implementation     |                                |                      |
| Verification       |                                |                      |
| Review             |                                |                      |
+--------------------+--------------------------------+----------------------+
```

- Left rail: stages, approval state, and invalidation warnings.
- Center: the selected stage editor or execution timeline.
- Right rail: context pack during spec stages; run status and checks during implementation.
- The task title, repository, branch/worktree, status, and current gate remain visible in a compact header.
- Agent assistance is contextual to the active stage. There is no unrelated generic chat inside the workbench.

Mobile layout:

- stage selector becomes horizontally scrollable tabs;
- context and run details open as a bottom sheet;
- primary approval or run action remains in a sticky footer;
- logs and diffs use dedicated full-screen views.

### Stage interactions

- `Draft with AI`: generate a proposed revision using the current context pack.
- `Compare`: show field and Markdown differences from the approved revision.
- `Approve`: approve the current revision and unlock the next stage.
- `Request changes`: record feedback without advancing.
- `Start run`: available only after the plan gate and repository safety checks.
- `Stop`: visible while an agent or check process is active.
- `Review`: displays final spec coverage, diff, checks, residual risks, and brain candidates.

## 13. Architecture

### Services

```text
TaskService
  - task CRUD
  - stage transitions
  - spec revisions and approvals

BrainServiceV2
  - knowledge CRUD and search
  - context pack assembly and snapshot
  - candidate capture and approval

EngineeringRunService
  - durable run state machine
  - iteration and gate orchestration
  - cancellation and recovery

AgentProvider
  - ClaudeProvider (V1)

CheckRunner
  - bounded command execution
  - output capture and cancellation

GitWorkspaceService
  - branch/worktree setup
  - status, diff, and head snapshots
  - cleanup
```

### Explicit boundary with workflows

`workflowService` remains responsible for generic repository operations such as fetch, pull, Docker, and terminal commands across repository selections.

`EngineeringRunService` owns task loops. It may call the same command runner, but it must not represent retries, human gates, or task state as workflow canvas nodes.

### Agent provider boundary

```ts
type AgentProvider = {
  inspect(cwd: string): Promise<AgentAvailability>;
  run(input: AgentRunInput, signal: AbortSignal): Promise<AgentRunResult>;
};
```

`ClaudeProvider` wraps the current Claude command integration. Spec drafting uses `plan`; implementation defaults to `acceptEdits`. `auto` requires explicit opt-in on every task.

The current synchronous 12-minute request must be replaced by an asynchronous run process managed by `EngineeringRunService`.

## 14. Persistence

V1 remains local-first under the repo-control config directory.

```text
~/.config/repo-control/engineering/
  projects/<project-key>/
    tasks.json
    brain.json
    context-packs/<context-pack-id>.json
  runs/<run-id>/
    run.json
    events.jsonl
    iterations/<iteration-number>.json
```

- Task and brain files use atomic temp-file rename, matching the existing services.
- Run events use append-only JSONL so partial progress survives a crash.
- Large stdout/stderr content can move to separate artifact files after V1.
- No secrets or environment values are persisted in prompts, logs, or brain entries.

### Migration

The existing brain file is version 1. Migration to version 2 is lazy and atomic.

Mapping:

- `bug` -> `fix`
- current status -> matching stage
- status becomes `done` only for old `done`; otherwise `active`
- `breakdown` -> `plan.notes`
- implementation log -> task timeline events
- decisions -> approved brain entries of kind `decision`, retaining task source
- Git and Claude session metadata remain attached to the task

A backup of the version 1 file is retained until the first successful version 2 write.

## 15. API Proposal

### Tasks and spec

```text
GET    /api/projects/:projectId/engineering/tasks
POST   /api/projects/:projectId/engineering/tasks
GET    /api/projects/:projectId/engineering/tasks/:taskId
PATCH  /api/projects/:projectId/engineering/tasks/:taskId
POST   /api/projects/:projectId/engineering/tasks/:taskId/spec/:stage/revisions
POST   /api/projects/:projectId/engineering/tasks/:taskId/spec/:stage/approve
POST   /api/projects/:projectId/engineering/tasks/:taskId/block
POST   /api/projects/:projectId/engineering/tasks/:taskId/resume
POST   /api/projects/:projectId/engineering/tasks/:taskId/archive
```

### Brain

```text
GET    /api/projects/:projectId/brain/entries
POST   /api/projects/:projectId/brain/entries
PATCH  /api/projects/:projectId/brain/entries/:entryId
DELETE /api/projects/:projectId/brain/entries/:entryId
POST   /api/projects/:projectId/brain/search
POST   /api/projects/:projectId/engineering/tasks/:taskId/context/preview
POST   /api/projects/:projectId/engineering/tasks/:taskId/context/snapshots
POST   /api/projects/:projectId/brain/candidates/:entryId/approve
```

### Runs

```text
POST   /api/projects/:projectId/engineering/tasks/:taskId/runs/preview
POST   /api/projects/:projectId/engineering/tasks/:taskId/runs
GET    /api/engineering/runs/:runId
GET    /api/engineering/runs/:runId/events
POST   /api/engineering/runs/:runId/cancel
POST   /api/engineering/runs/:runId/resume
POST   /api/engineering/runs/:runId/gates/:gateId/approve
POST   /api/engineering/runs/:runId/gates/:gateId/reject
```

`GET /events` uses Server-Sent Events in V1. The client reconnects using the last event ID. Polling remains as a fallback.

## 16. Run Data Model

```ts
type EngineeringRun = {
  id: string;
  taskId: string;
  projectId: string;
  status:
    | "queued"
    | "running"
    | "human-gate"
    | "succeeded"
    | "failed"
    | "cancelled";
  policy: LoopPolicy;
  specSnapshot: {
    revisionByStage: Record<TaskStage, number>;
    hash: string;
  };
  contextPackId: string;
  workspace: {
    mode: "worktree" | "current-branch";
    path: string;
    branch: string;
    baseHead: string;
    finalHead: string | null;
  };
  iterations: EngineeringIteration[];
  activeGate: HumanGate | null;
  startedAt: string | null;
  completedAt: string | null;
};

type EngineeringIteration = {
  number: number;
  status: "running" | "passed" | "failed" | "cancelled";
  agentSessionId: string | null;
  promptHash: string;
  changedFiles: string[];
  diffStat: string;
  checkResults: CheckResult[];
  failureSignature: string | null;
  startedAt: string;
  completedAt: string | null;
};
```

## 17. Safety and Concurrency

- Only one active engineering run per project or worktree.
- Starting on the current branch requires a clean working tree or explicit user confirmation with a checkpoint.
- Worktree mode is the default and never mutates the user's current checkout.
- Commands come from the approved plan or a repository allowlist.
- Shell commands are displayed in the run preview before execution.
- Process trees are cancellable and time-bounded.
- Repeated identical failures stop instead of consuming the full loop budget.
- Permission escalation, destructive Git operations, and external publishing require a human gate.
- Task completion is rejected if the approved spec hash differs from the run spec hash.

## 18. Observability

The task timeline records immutable events:

- spec revision created or approved;
- approval invalidated;
- context entry pinned or excluded;
- run queued, started, cancelled, or completed;
- iteration started and completed;
- agent session and permission mode;
- Git head and diff summary;
- each verification check and duration;
- human gate decision;
- brain candidate created or approved.

The UI must distinguish user actions, agent actions, commands, checks, and system decisions.

## 19. Acceptance Criteria

### Spec-driven development

- A user can create feature, fix, refactor, chore, and spike tasks.
- A task cannot enter implementation without approved definition, requirements, design, and plan revisions.
- Editing an approved stage invalidates downstream approvals.
- Every required acceptance criterion is linked to at least one verification method before the plan can be approved.
- Lean task profiles reduce form size without bypassing gates.

### Second brain

- A user can create, edit, deprecate, tag, filter, and approve brain entries.
- Every brain entry displays its provenance.
- A task context pack can be previewed and edited before a run.
- A run stores an immutable context pack snapshot.
- Agent-generated brain entries remain candidates until approved by the user.

### Loop engineering

- A user can preview commands, context, policy, branch/worktree, and checks before starting.
- A run is cancellable while the agent or a check is active.
- Every iteration records prompt hash, Git head/diff, changed files, and check evidence.
- The loop stops on pass, timeout, cancellation, budget exhaustion, repeated failure, or human gate.
- A task cannot be marked done while required checks are failing or stale relative to the final Git head.
- Run state and events remain readable after a server restart.

### UX

- Desktop exposes task queue, workbench, context, and run state without nested modal workflows.
- Mobile exposes the same capabilities with stage tabs and context/run sheets.
- Running, blocked, approval-needed, failed, and completed states are visually distinct and accessible.
- Keyboard navigation reaches every stage, gate, and run control.

## 20. Delivery Plan

### Milestone 0 - Domain and migration

- Introduce V2 task, spec revision, approval, brain entry, run, iteration, and event types.
- Add version 1 to version 2 brain migration with backup.
- Split stage from status.
- Add service-level transition and invalidation tests.

### Milestone 1 - Task Workbench

- Add top-level Tasks navigation and task queue.
- Implement create flow and task profiles.
- Implement structured stage editors, revisions, diffs, and approvals.
- Reuse current task CRUD where compatible.

### Milestone 2 - Brain Library

- Implement brain entry CRUD, filtering, provenance, and candidates.
- Implement deterministic context search and context pack preview.
- Add task context rail and immutable snapshots.

### Milestone 3 - Engineering Run MVP

- Implement Git worktree service and safety preflight.
- Implement Claude provider adapter and asynchronous run process.
- Implement one bounded iteration, checks, cancellation, JSONL events, and SSE.
- Add run preview and timeline UI.

### Milestone 4 - Loop and recovery

- Add retries, failure signatures, loop budgets, and human gates.
- Add crash recovery and resume semantics.
- Add brain candidate extraction and final review gate.

### Milestone 5 - Hardening

- End-to-end tests for feature, fix, and refactor profiles.
- Process cancellation and timeout tests.
- Migration, corruption recovery, and concurrent-run tests.
- Desktop/mobile accessibility and long-output performance tests.

## 21. Recommended First Implementation Slice

The first vertical slice should prove the complete product model without implementing autonomous retries:

1. create a `fix` task;
2. complete and approve a lean spec;
3. preview and freeze a context pack;
4. create an isolated worktree;
5. run one Claude implementation iteration;
6. execute declared checks;
7. show evidence in the task timeline;
8. approve the review and capture one brain candidate.

This slice validates all three pillars end to end. Automatic retries are added only after one iteration is durable, cancellable, and trustworthy.

## 22. Decisions to Preserve

- One unified Task Workbench owns spec, brain context, and loop execution.
- The generic workflow canvas does not become the engineering loop engine.
- Spec approvals are revision- and hash-bound.
- Context packs and run evidence are immutable snapshots.
- Worktree mode is the safe default.
- Loops are bounded and stop at human gates.
- Brain promotion always requires user approval.
- V1 is local-first and Claude-first, with provider interfaces for later extension.
