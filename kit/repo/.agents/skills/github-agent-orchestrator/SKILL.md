---
name: github-agent-orchestrator
description: Use when Codex must bootstrap or run a GitHub-native agent queue using GitHub Issues, GitHub Project v2, labels, PR evidence, Codex threads, worktrees, heartbeat automation, Worker packets, or Orchestrator handoff.
---

# GitHub Agent Orchestrator

## Overview

Run the repository's GitHub-native Codex Orchestrator loop. GitHub is the durable state ledger; Codex threads and worktrees are execution surfaces.

Before acting, read `AGENTS.md` and `docs/github-agent-workflow.md`.

## Required Invariants

- Never launch work from memory; re-read GitHub state on every heartbeat.
- Max active workers: 2.
- Max worker launches per Orchestrator: 5.
- State Ledger Comment must be written before Worker launch.
- GitHub Project v2 is required.
- State ledger lives in issue comments, not a tracked repo state file.
- Orchestrator executes Ready work; it does not invent new backlog when the queue is idle.
- If the latest ledger is `DRAINING` or Handoff YAML exists, perform replacement takeover before any Worker launch.
- Stop for conservative human gates: merge, deploy, secrets, billing, destructive ops, production data, migrations, auth/permissions/public API risk, and production dependencies.

## Preflight

1. Run or request `gh auth status`.
2. Confirm repository `owner/repo`, default branch, and GitHub Project v2 owner/number.
3. Verify required files exist:
   - `AGENTS.md`
   - `docs/github-agent-workflow.md`
   - `.github/ISSUE_TEMPLATE/agent-task.yml`
   - `.github/pull_request_template.md`
   - `.github/workflows/readiness-audit.yml`
   - `.agents/skills/github-agent-worker/SKILL.md`
4. Verify labels:
   - `agent-ready`, `blocked`, `qa-required`, `security-review`, `design-review`, `docs`, `automation`, `workflow`, `human-action-required`.
5. Verify Project fields:
   - `Status`, `Work Type`, `Risk`, `QA Required`.

If any mutation cannot be done through available tools, emit `Human action required` with exact `gh` commands or UI paths.

## State Decision

Before launching work, classify the repository state from GitHub:

- `bootstrap_needed`: required kit files, labels, Project v2 fields, templates, or readiness workflow are missing. Use Bootstrap Flow.
- `active_orchestration`: Ready or In Progress issues exist, or the latest ACTIVE ledger has active claims. Use Heartbeat Loop.
- `handoff_takeover_required`: latest ledger says `DRAINING`, or Handoff YAML exists. Audit state, write `handoff accepted`, then continue Heartbeat Loop.
- `idle_after_completed_wave`: no Ready or In Progress issues remain, recent issues are Done, and recent PRs are merged. Do not launch Workers. Emit an idle ledger and ask for a Continuation Planner or human-created Ready issues.

If Ready issues exist, run Orchestrator. If Ready issues do not exist and the product needs more work, the next role is Continuation Planner, not Orchestrator.

## Bootstrap Flow

Use this flow for an existing project without an agent workflow:

1. Audit README, docs, `AGENTS.md`, package manager, scripts, tests, CI, deploy/release constraints, branch protection expectations, and `.github/`.
2. Produce one Project Intake Packet for missing human decisions.
3. Produce and apply the GitHub Setup Packet.
4. Create setup-sized issues from Planner handoff.
5. Mark only setup-ready issues as `agent-ready`.
6. Start product delivery only after setup verification passes.
7. Pilot exactly one low-risk issue through the full loop.

## Heartbeat Loop

On each heartbeat:

1. Read GitHub Project Ready Queue and active In Progress issues.
2. Read issue body, labels, comments, blockers, linked PRs, Actions status, and recent Worker reports.
3. Update the State Ledger Comment.
4. Verify existing Worker PR evidence before moving issues to Review.
5. Move blocked issues to Blocked and add `human-action-required` when needed.
6. Select executable issues until active workers reach 2.
7. For each selected issue, run the Ready gate.
8. Write claim state before creating a Worker.
9. Generate a task-scoped Worker Packet.
10. Create a Worker thread/worktree when Codex thread tools are available; otherwise emit a copyable Worker prompt.
11. Stop launching after the fifth Worker launch and emit Handoff YAML.
12. If no Ready or In Progress issues exist, stop. Write an idle State Ledger Comment with next action: `Run Continuation Planner` or `Create new Ready issues`.

## Ready Gate

An issue is executable only when all are true:

- Project `Status = Ready`;
- label `agent-ready`;
- no `blocked` label;
- no unresolved dependency or blocker comment;
- no active claim in the latest State Ledger Comment;
- no open linked PR for the same issue;
- issue body includes Goal, Acceptance Criteria, Dependency / Blocker State, Validation Expectations, Security Impact, UI / Design Impact, QA Requirement, Primary Signal, Secondary Signals, Model / Risk expectation, TDD / Exemption, and repository tracing.

If any check fails, do not launch a Worker.

## Claim Format

Write this before Worker launch:

```md
## State Ledger Comment

Orchestrator: <thread-id-or-name>
Status: ACTIVE
Worker launches: <n>/5
Active workers: <n>/2

Claimed issues:
- #<issue>: claimed by <worker-thread-id-or-pending>, branch <branch>, PR none, status launching

Next action:
- Launch Worker with packet below.
```

## Worker Packet

Include repository, issue number, branch, scope, out of scope, readiness evidence, model/router reason, validation commands, evidence requirements, and human gates. The Worker must use `$github-agent-worker`.

## Evidence Review

Do not move an issue to Review unless the PR or issue contains:

- linked issue and `Closes #<issue>`;
- acceptance evidence;
- TDD RED/GREEN or valid docs/config-only exemption;
- repository tracing;
- validation commands and results;
- security/design notes;
- QA evidence or explicit no-QA rationale;
- Worker Completion Report.

If evidence is missing, comment with missing items and leave the issue In Progress or Blocked.

## Idle Queue

When the Ready Queue is empty and no workers are active:

1. Re-read recent closed issues, merged PRs, and the latest State Ledger Comment.
2. Confirm there is no DRAINING handoff waiting for takeover.
3. Write a State Ledger Comment with `Status: ACTIVE` or `Status: RETIRED`, `Active workers: 0/2`, and `Claimed issues: none active`.
4. Set `Next action` to `Run Continuation Planner` unless the human has already supplied new Ready issues.
5. Do not create issues, branches, PRs, or Worker packets from memory.

## Handoff

After five Worker launches:

1. Stop new launches.
2. Update ledger status to `DRAINING`.
3. Emit Handoff YAML from `docs/github-agent-workflow.md`.
4. Create a replacement Orchestrator thread if tools are available.
5. The replacement must audit GitHub state before launching work.
6. Become `RETIRED` only after the replacement writes `handoff accepted`.

## Human Action Required

Use this exact shape:

```md
## Human action required

Blocked action:
Reason:
Issue:
Required human decision:
Exact command or URL:
Exact labels / Project fields / issue body:
Safe to continue after:
```
