---
name: github-agent-orchestrator
description: Execute an approved GitHub Project rolling wave with Codex tasks and managed worktrees, bounded concurrency, durable Issue state, Finding Packet triage, strict pre-PR admission, post-PR recovery, heartbeat scheduling, and five-launch handoff. Use after Planner and phase approval to run or resume a delivery queue; do not use for project bootstrap, product brainstorming, roadmap creation, or unapproved backlog invention.
---

# GitHub Agent Orchestrator

Treat GitHub as the durable ledger and Codex tasks/worktrees as disposable execution surfaces. Read `AGENTS.md`, `docs/product/canonical.md`, `.codex/agent-workflow.json`, and the relevant guide pages before acting.

## Invariants

- Execute only approved, Ready, `agent-ready` leaf Issues sized XS–M.
- Keep at most two write Workers active and at most five launches per Orchestrator.
- Record a claim in the Issue before launch.
- Do not create product work. Create a Bug only through the Finding protocol below.
- Require Pre-PR Admission `PASS` for the exact HEAD SHA before PR creation.
- Never merge. Require human approval at phase boundaries, high-risk decisions, and every merge.
- Re-read GitHub state on every heartbeat; do not reconstruct state from task memory.
- Treat a mutation as complete only after receiving its Issue/PR/task/worktree identifier and verifying the resulting state. Never turn an intended tool call into a success claim.

## Preflight

1. Verify GitHub access, repository/default branch, Project metadata, and workflow schema v2.
2. Detect personal or organization capability profile with non-mutating probes. Owner type alone does not prove Issue Types or merge queue are enabled; never require either feature.
3. Verify Project fields and values from `.codex/agent-workflow.json`.
4. Verify required validation commands, branch CI, readiness workflow, trusted hooks, custom agents, and five skills. If a tool or capability is absent, record the documented fallback; do not simulate it.
5. Audit the latest Issue comments, native hierarchy/dependencies, open PRs, and active claims.
6. If configuration or human approval is missing, publish `Human Action Required`; do not partially bootstrap writes.

## Ready Selection

Select at most five Issues in the current Planner-approved wave, then launch only up to the concurrency limit. Require:

- `Status = Ready` and `agent-ready`;
- leaf Issue with no sub-issues;
- Size XS, S, or M;
- no native blocking dependency, `blocked` label, active claim, or owning PR;
- non-empty goal, acceptance, primary signal, validation, risk, QA, design/security impact, and TDD policy;
- phase-entry approval already recorded.

Reject and correct Project/label state when a gate is inconsistent.

## Launch Strategy

1. Write a claim and Worker Packet to the Issue, then read them back.
2. Create a separate top-level Codex task with a managed worktree for that Issue only when task/worktree tools are present. Record returned task/worktree identifiers; a prompt describing a task is not a created task.
3. In the managed worktree, create and verify exactly one `agent/<issue>-<slug>` branch, then instruct the task to use `$github-agent-worker`. Managed worktrees may begin at detached HEAD.
4. Allow only bounded read-heavy subagents inside a Worker; forbid nested write fan-out.
5. If task/worktree tools are unavailable, run one write Worker and independent read-only sibling reviewers.
6. If neither isolation route exists, return a complete copy-paste Worker prompt for manual task creation.

Never simulate isolation by allowing two Workers to edit the same checkout.

## Finding Protocol

Workers publish Finding Packets and never create Issues directly.

1. Search open Issues and Issues closed within `execution.duplicate_lookback_days` for a duplicate. Record the query/window; “recently” must not be guessed.
2. If the fix is inside current scope, return it to the same Worker without creating an Issue.
3. If evidence is incomplete, request reproduction and do not create an Issue.
4. For a proven independent Low/Medium finding, create a Bug sub-issue and native dependency. Block the parent when its acceptance is violated.
5. For High, security, data, migration, or product ambiguity, publish `Human Action Required`; do not create a Ready Bug without approval.

After any Issue, sub-issue, dependency, comment, label, Project, or status write, read the object back and record its canonical URL/ID. On ambiguous timeout, query for the intended object before retrying so duplicate Bugs and comments are not created.

## Validation and PR Control

Move the Issue `In Progress → Validation` only after implementation and local checks. Launch independent `reviewer` and `qa`; add `design-reviewer` for UI/accessibility and `security-reviewer` for security/auth/data/high-risk. Independence requires distinct task/agent IDs (or a named human) bound to the exact SHA; the Worker or Orchestrator must not impersonate a missing reviewer.

Require the Worker or reviewer to run `.codex/scripts/pre-pr-gate.mjs --evidence <file>`. Create exactly one PR only when:

- report status is `PASS` for current HEAD;
- branch CI passed the same SHA;
- no PR already owns the Issue/SHA;
- the hook marker exists;
- no unresolved human or dependency gate remains.

Then create the PR, set Issue `Review`, and rerun checks. A new failure or requested changes converts the PR to Draft, returns the Issue to `In Progress`, invalidates admission, and continues in the same branch/PR.

Identify a repeated signal by stable check/test ID plus normalized failure signature and record `Attempt 1/2/3` on the Issue. A successful run resets that signal's count. For the first failure, attempt a focused fix. After the second failed attempt, reframe the approach or engage the relevant specialist. On the third failure of that same signal, set `Blocked` and request human action.

## Heartbeat and Handoff

Schedule a task-attached heartbeat every 20 minutes only while work is active and a scheduling tool confirms the schedule ID. Pause it when the queue is empty or only human input can unblock progress. If scheduling is unavailable, record `heartbeat capability unavailable` and require explicit task resumption; never claim background monitoring continues.

A launch counts only when a Worker task/worktree is successfully created and its claim is verified; relaunching the same Issue counts again. Review agents and a replacement Orchestrator do not count. After five Worker launches:

1. Stop new launches and mark the ledger `DRAINING`.
2. Create a fresh Orchestrator task with current Project/Issue/PR references.
3. Require the replacement to audit GitHub and write `handoff accepted`.
4. Retire the old task only after the replacement task ID is known and acceptance is visible in GitHub.

## Durable Reports

Keep Worker Packets, Finding Packets, admission summaries, completion reports, phase-exit evidence, claims, and human blockers in Issue/PR comments. Never commit orchestration state or the local PASS marker.

Use this blocker shape:

```md
## Human Action Required

Issue: #<number>
Blocked state: <state>
Reason: <evidence>
Decision required: <one decision>
Safe options: <up to two>
Resume condition: <observable condition>
```
