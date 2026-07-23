---
title: Orchestration
description: Canonical task topology, fresh Worker tasks, conflict arbitration, merge, heartbeat, and handoff.
order: 6
slug: orchestration
---

# Orchestration

This page is the canonical task topology. Other pages refer here instead of duplicating it.

![Canonical task topology from Brainstorm through post-merge archive](./assets/task-topology.svg)

Codex subagents reduce main-task context pollution but consume additional tokens. Use them for bounded review/QA, not as recursive write fan-out. Managed worktrees isolate top-level task changes. Probe current task/worktree/scheduling capabilities before relying on them.

## Start and materialize

One fresh Orchestrator handles one approved wave. Its Start Packet binds the execution repository, roadmap/Phase Plan revisions and digests, base SHA, exact plan IDs, mode, and one durable Wave Authority Lease. The same lease covers scoped materialization, Worker launch, routine lifecycle writes, retries, and Low-risk merge only when the selected profile permits it.

`materialization_only` authorizes exact GitHub ledger setup and no Worker activity. `wave_execution` authorizes at most five top-level Worker launches, at most two concurrent writers on disjoint conflict keys, managed worktrees, monitoring, high-risk review tasks, post-Done archive, and merge only after a later exact authorization.

Orchestrator does not write product code, infer missing fields, or invent backlog. It validates lock/config/remote/packet identity and manifest ownership before writes. It materializes only the execution horizon and publishes one report containing a stable operation journal. Closed Issues, advanced statuses, existing relations, and completed operation IDs are preserved.

GitHub preflight must prove target and source-maintenance access separately. If a target Issue touches managed core, do not launch its Worker: search/create the fingerprinted source Issue, run source delivery, install the exact merged source SHA into the target, run target regression, and resume the original wave. Without source access, publish `BLOCK_AND_REPORT`.

## Materialization-only Start prompt — EN

```text
Use $github-agent-orchestrator in a fresh top-level Codex task for <owner/repo> in materialization_only mode.
Global Roadmap Packet: <complete-approved-json>
Phase Plan Packet: <complete-approved-json>
Start Packet with repository and Wave Authority Lease: <complete-approved-json>
Recompute packet digests and validate the Start Packet before writes. Materialize only the current horizon, resume completed operation IDs, preserve closed/advanced state, and publish the full lifecycle journal. Create no Worker activity in this mode.
```

## Промпт materialization-only — RU

```text
Используй $github-agent-orchestrator в новой top-level Codex task для <owner/repo> в режиме materialization_only.
Global Roadmap Packet: <полный-утверждённый-json>
Phase Plan Packet: <полный-утверждённый-json>
Start Packet: <полный-утверждённый-json>
До любой записи пересчитай оба packet digests, запусти validatePlanContracts с обязательным approval и проверь Start Packet. Материализуй точный утверждённый набор сверху вниз, создай native relationships и Project fields, прочитай каждую запись обратно и опубликуй один Plan Materialization Report в утверждённом parent Issue. Не создавай claims, Workers, heartbeat, branches, PR или merge actions. Не додумывай и не исправляй отсутствующие данные; вместо этого верни Human Action Required.
```

## Wave-execution Start prompt — EN

```text
Use $github-agent-orchestrator in a fresh top-level Codex task for exactly one wave in saved project <project> in wave_execution mode.
Global Roadmap Packet: <complete-approved-json>
Phase Plan Packet: <complete-approved-json>
Start Packet: <complete-approved-json>
Validate repository identity, ownership, revisions, digests, Ready IDs, base SHA, lease scope/budgets/expiry, and profile before writes. Resume/materialize the current horizon and launch the first eligible Worker in the same session. Use risk-tiered review; require separate exact merge authorization only where profile/risk requires it.
```

## Промпт wave-execution — RU

```text
Используй $github-agent-orchestrator в новой top-level Codex task ровно для одной wave в saved project <project> в режиме wave_execution.
Global Roadmap Packet: <полный-утверждённый-json>
Phase Plan Packet: <полный-утверждённый-json>
Start Packet: <полный-утверждённый-json>
До любой записи проверь все revisions, digests, точные Ready IDs, conflict keys, base SHA, expiry и authority. Материализуй точные утверждённые contracts, затем создай не более пяти новых top-level Worker tasks в managed worktrees, держи максимум двух непересекающихся write Workers, мониторь/направляй их, создавай нужные top-level high-risk review tasks и архивируй Workers только после post-merge Done. Не делай fork этой task, не пиши продуктовый код, не придумывай backlog, не публикуй локальные пути и не merge без отдельного разрешения на точные PR/head SHA.
```

## Transactional launch and concurrency

Claim → `CREATING` → `LAUNCHED`. A queued/client ID is not a launch. Count only matching canonical task/worktree IDs with top-level/managed ownership and verified ready/running state. On ambiguity, search existing tasks before retrying; on creation failure, release the claim without consuming a launch. Never use `fork_thread`, `/private/tmp`, or a handmade worktree as the normal execution surface.

Build the occupied set from active `conflict_keys`. Before claim, classify touch points: the manifest is authoritative for Kit-listed paths; non-manifest product paths require an explicit host declaration backed by the approved target surface; generated paths require generator evidence. Managed, generated, or unknown paths never reach target Worker creation. Stale claim recovery requires task absence, three missed heartbeats, and no branch or PR; recovery reuses the lease.

## Worker launch prompt — EN

```text
Use $github-agent-worker in this fresh top-level managed-worktree task.
Raw Issue: <issue-url-and-body>
Worker Packet with identity/ownership/source/lease bindings: <worker-packet>
Canonical revisions: <links-and-revisions>
Work on this target-owned leaf as sole tracked-file author. Run identity and ownership preflight before RED. Return SOURCE_REPAIR_REQUIRED, GENERATOR_REQUIRED, or BLOCKED without writes when applicable. Use TDD, profile/risk-appropriate review, branch CI, clean tree, and deterministic admission.
```

## Промпт запуска Worker — RU

```text
Используй $github-agent-worker в этой новой top-level managed-worktree task.
Raw Issue: <issue-url-and-body>
Worker Packet: <worker-packet>
Canonical revisions: <links-and-revisions>
Работай только над target-owned leaf как единственный автор tracked files. До записи проверь identity/ownership/source/lease bindings; верни SOURCE_REPAIR_REQUIRED, GENERATOR_REQUIRED или BLOCKED без tracked writes, если preflight не пройден. Используй TDD, review topology профиля/риска, branch CI, fresh base, clean tracked tree и deterministic admission. Не создавай Issues и не merge.
```

## Findings, merge, and post-merge

Worker returns Finding Packets; Orchestrator performs authoritative duplicate search, returns in-scope fixes, creates proven independent Low/Medium Bugs, and escalates High/security/data/migration/product ambiguity.

`solo_fast` Low risk may merge automatically after deterministic admission and complete readback. Other merges require repository/PR/head/base/admission-digest authorization. Every profile requires merge-commit readback and post-merge CI before Done/archive.

## Heartbeat and Handoff

Attach the 20-minute schedule only while work is active; pause when idle or awaiting a human. Handoff persists authority ID, source/target bindings, operation journal cursor, write/launch budget, claims, and PR state. A new task does not trigger a new approval.

### Handoff / takeover prompt — EN

```text
Use $github-agent-orchestrator in a fresh top-level task. Reconstruct wave <wave-id> from GitHub and canonical contracts using this Orchestrator State/Handoff Packet: <packet>. Do not trust prior chat history. Verify every claim, task ID, branch, PR, SHA, attempt, and heartbeat. Write takeover readback before the old Orchestrator is archived. Do not launch until the handoff is accepted.
```

### Промпт handoff / takeover — RU

```text
Используй $github-agent-orchestrator в новой top-level task. Восстанови wave <wave-id> из GitHub и canonical contracts по этому Orchestrator State/Handoff Packet: <packet>. Не доверяй истории прошлого чата. Проверь каждый claim, task ID, branch, PR, SHA, attempt и heartbeat. Запиши takeover readback до архивирования старого Orchestrator. Не запускай Workers до принятия handoff.
```
