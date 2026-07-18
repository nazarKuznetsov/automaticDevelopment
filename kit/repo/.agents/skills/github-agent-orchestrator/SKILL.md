---
name: github-agent-orchestrator
description: Materialize digest-bound Global Roadmap and Phase Plan packets, then optionally execute one GitHub rolling wave with fresh top-level managed-worktree Workers, transactional claims, exact-SHA admission, human-authorized merges, and post-merge reconciliation. Use in materialization-only or wave-execution mode with a valid Orchestrator Start Packet; never write product code or invent backlog.
---

# GitHub Agent Orchestrator

Treat GitHub as the durable ledger and tasks/worktrees as disposable execution surfaces. Read [references/orchestrator-state-machine.md](references/orchestrator-state-machine.md) before materialization, task creation, claim recovery, merge, or handoff.

## Invariants

- Scope one fresh top-level Orchestrator task to one approved materialization or wave.
- Never implement product code or run a write Worker as an Orchestrator subagent.
- Execute only approved Ready, `agent-ready`, unblocked leaf Issues sized XS–M.
- Keep at most two write Workers, only when `conflict_keys` are disjoint.
- Create each Worker as a fresh top-level task in the saved project with a managed worktree. Never use `fork_thread`, copied Orchestrator history, `/private/tmp`, or a hand-made worktree as the normal path.
- Count a launch only after matching canonical task/worktree IDs, ownership, and states are read back.
- Require independent admission for the exact SHA before PR creation and human authorization for the exact PR/head SHA before merge.
- Mark Done and archive the Worker only after merge readback and successful post-merge CI.

## Preflight and Materialization

1. Verify workflow v2, Start Packet mode/revisions/digests/expiry/authority, repository/default branch, Project schema, validation, native hierarchy/dependency mutation capability, and authenticated GitHub Project access with non-mutating probes. Run `evaluateOrchestratorStart(contracts, startPacket)` from `.codex/scripts/workflow-contract.mjs`; any blocker stops all writes. Probe task/worktree/scheduling capability only for `wave_execution`.
2. If a required mutation is unavailable, publish Human Action Required. A comment is not a fallback relationship.
3. Read the complete Global Roadmap and Phase Plan packets. Recompute both digests and run `validatePlanContracts(..., { require_approval: true })`; never reconstruct missing packet content from prose or chat summaries.
4. Resolve the Start Packet's approved `plan_item_id` values against both exact packets. Issue numbers are outputs, never Start Packet inputs. Require exact titles and all Project fields for every materialized item.
5. Materialize exactly and idempotently: Issues top-down, native sub-issues, native dependencies, Project items/fields, and read-after-write. Publish the Plan Materialization Report as one durable comment on the mapped Issue named by `materialization_report_parent_plan_item_id`.
6. In `materialization_only`, require zero Worker authority and leave `agent_ready_readback` empty when `ready_wave` is empty. In `wave_execution`, apply `agent-ready` only to exact passing leaves after all typed readback.
7. Never change approved titles, metadata, scope, dependencies, acceptance, report parent, or order. Request a new digest-bound Planner revision instead.

## Modes

- `materialization_only`: may materialize up to 100 approved plan items; creates no claims, Workers, heartbeat, branch, PR, or merge authority.
- `wave_execution`: materializes and executes only one approved Ready wave of at most five leaves; all Worker/merge invariants apply.

## Claims and Worker Tasks

1. Re-read Ready state and select disjoint surfaces.
2. Record a claim and Worker Packet, including `base_sha_at_launch`, then read both back.
3. Create a fresh top-level Worker task with only the raw Issue, Worker Packet, canonical contract links, and exact revisions. Do not copy the roadmap or Orchestrator conversation.
4. Treat a queued/client ID as `CREATING`. Verify canonical task ID and managed worktree before `LAUNCHED` or launch-count increment.
5. On ambiguous creation, search existing tasks before retry. On failure, release the claim without consuming a launch.
6. A claim is stale only when the task is absent, three heartbeats were missed, and neither branch nor PR exists.

## Monitor

- Stop a Worker before writes when it returns a Surface Update that overlaps an active conflict key; update ordering/dependencies through the approved workflow.
- Low/Medium review uses fresh direct Worker subagents: reviewer, non-authoring QA, and a distinct admission-reviewer; design/security are conditional. High/security/auth/data/migration review is a separate top-level task plus a human gate.
- Triage Finding Packets only through the documented duplicate/in-scope/independent/high-risk branches. Workers never create Issues.
- Return post-PR failures or requested changes to the same Worker task, branch, and Draft PR.

## Merge and Reconciliation

After a human submits a Merge Authorization Packet bound to repository, exact PR/head/base SHA, and admission report digest, re-read all bindings, checks, dependencies, and review threads. Any head/base/admission change invalidates review, QA, admission, and authorization. If fresh, merge with `expected_head_sha`; require canonical PR/head/merge-commit readback plus post-merge CI bound to that merge commit before Done/archive. A post-merge failure creates a blocking Finding/Bug path and leaves the parent outside Done.

## Heartbeat and Handoff

Attach a 20-minute heartbeat only while the wave has active work; pause when idle or waiting for a human. Stop new launches at five. Complete Handoff Packet, create a fresh replacement when needed, and archive the old Orchestrator only after takeover readback. A new wave always starts a new Orchestrator task. A materialization-only task terminates after its report readback and never rolls into execution.
