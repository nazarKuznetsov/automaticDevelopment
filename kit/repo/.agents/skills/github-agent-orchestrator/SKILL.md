---
name: github-agent-orchestrator
description: Execute one repository-bound Wave Authority Lease by materializing a monotonic resumable horizon, routing managed-core work to its recorded kit source, and launching risk-tiered fresh Workers. Use with a valid Orchestrator Start Packet; never write product code, invent backlog, or launch a Worker before identity and ownership preflight.
---

# GitHub Agent Orchestrator

Treat GitHub as the durable ledger and tasks/worktrees as disposable execution surfaces. Read [references/orchestrator-state-machine.md](references/orchestrator-state-machine.md) before materialization, task creation, claim recovery, merge, or handoff.

## Invariants

- Scope one fresh top-level Orchestrator task to one approved materialization or wave.
- Treat kit source, installation target, execution target, and maintenance target as distinct identities read from lock/config/packets and GitHub.
- Reuse one valid Wave Authority Lease across scoped writes, retries, task replacement, and Worker launches; do not ask again unless its scope, risk, revision, budget, or expiry changed.
- Never implement product code or run a write Worker as an Orchestrator subagent.
- Execute only approved Ready, `agent-ready`, unblocked leaf Issues sized XS–M.
- Keep at most two write Workers, only when `conflict_keys` are disjoint.
- Create each Worker as a fresh top-level task in the saved project with a managed worktree. Never use `fork_thread`, copied Orchestrator history, `/private/tmp`, or a hand-made worktree as the normal path.
- Count a launch only after matching canonical task/worktree IDs, ownership, and states are read back.
- Apply the configured risk profile: one combined reviewer/QA plus deterministic admission for non-regulated Low risk; separate reviewer/QA/admission for Medium and `regulated`; specialist top-level review for High. Low-risk auto-merge is allowed only when the selected profile and repository policy allow it.
- Keep the Start capability envelope least-privileged: `create_high_risk_review_tasks` is true only when the approved wave actually contains High-risk work.
- Mark Done and archive the Worker only after merge readback and successful post-merge CI.

## Preflight and Materialization

1. Verify lock v3 source/target provenance, config/remote/Start repository identity, Start revisions/digests, Wave Authority Lease, Project schema, validation, native mutation capability, and authenticated access. Run `evaluateOrchestratorStart`; any blocker stops writes.
2. If a required mutation is unavailable, publish Human Action Required. A comment is not a fallback relationship.
3. Read the complete Global Roadmap and Phase Plan packets. Recompute both digests and run `validatePlanContracts(..., { require_approval: true })`; never reconstruct missing packet content from prose or chat summaries.
4. Resolve only the execution horizon: at most five Ready leaves, their minimum parents, and dependencies that block the wave. The rest of the roadmap remains an approved artifact.
5. Before Worker creation, build an exact ownership partition. The manifest is authoritative for every Kit-listed path; non-manifest product paths require an explicit host declaration backed by the target tree/approved surface, and generated paths require generator evidence. Run `evaluateWorkerPreflight` with that partition. Unknown paths block; generated paths require their generator; managed paths return `SOURCE_REPAIR_REQUIRED` and route through a Kit Maintenance Packet. Never discover ownership after implementation.
6. Build a stable operation journal. Never reopen a closed Issue, lower a Project status, remove a relation, or repeat a completed operation. Persist `run_id`, before/target/after/action, completed IDs, remaining IDs, and resume state in the durable Plan Materialization Report.
7. For source maintenance, drive `evaluateSourceMaintenanceProgress`: search the fingerprint first; create at most one source Issue; link the target Issue; launch a source Worker only if no reusable PR exists; validate/merge the source PR; install the exact merged SHA into the target; run target regression; then resume the same wave/journal. If access fails, publish `BLOCK_AND_REPORT`; never patch managed core in the target.
8. In `materialization_only`, require zero Worker authority and leave `agent_ready_readback` empty when `ready_wave` is empty. In `wave_execution`, apply `agent-ready` only to exact passing leaves after all typed readback.
9. Never change approved titles, metadata, scope, dependencies, acceptance, report parent, or order. Request a new digest-bound Planner revision instead.

## Modes

- `materialization_only`: materializes only the approved current horizon and creates no Worker activity.
- `wave_execution`: materializes and executes only one approved Ready wave of at most five leaves; all Worker/merge invariants apply.

## Claims and Worker Tasks

1. Re-read Ready state and select disjoint surfaces.
2. Record a claim and Worker Packet including repository identity, touch ownership, allowed paths, kit source binding, managed-change policy, authority lease, and `base_sha_at_launch`; read both back.
3. Create a fresh top-level Worker task with only the raw Issue, Worker Packet, canonical contract links, and exact revisions. Do not copy the roadmap or Orchestrator conversation.
4. Treat a queued/client ID as `CREATING`. Verify canonical task ID and managed worktree before `LAUNCHED` or launch-count increment.
5. On ambiguous creation, search existing tasks before retry. On failure, release the claim without consuming a launch.
6. A claim is stale only when the task is absent, three heartbeats were missed, and neither branch nor PR exists.

## Monitor

- Stop a Worker before writes when it returns a Surface Update that overlaps an active conflict key; update ordering/dependencies through the approved workflow.
- Review topology comes from `reviewTopologyForRisk`; do not create the regulated role set for every Low-risk change.
- Triage Finding Packets only through the documented duplicate/in-scope/independent/high-risk branches. Workers never create Issues.
- Return post-PR failures or requested changes to the same Worker task, branch, and Draft PR.

## Merge and Reconciliation

For `solo_fast` Low risk, merge automatically only after deterministic admission, required checks, dependency/thread readback, and repository policy allow it. Medium/High and all non-solo profiles require an exact Merge Authorization Packet. Every merge still requires canonical merge readback and post-merge CI before Done/archive.

## Heartbeat and Handoff

Attach a 20-minute heartbeat only while the wave has active work; pause when idle or waiting for a human. Stop new launches at five. Complete Handoff Packet, create a fresh replacement when needed, and archive the old Orchestrator only after takeover readback. A new wave always starts a new Orchestrator task. A materialization-only task terminates after its report readback and never rolls into execution.
