---
title: Contracts
description: Product contract, secret-free machine config, packet schemas, and evidence semantics.
order: 10
slug: contracts
---

# Public contracts

## Canonical product contract

`docs/product/canonical.md` defines goal, audience, scenarios, MVP/non-goals, design references, architecture constraints, quality bar, risks, assumptions, release criteria, open decisions, and approved revision.

## Machine contract

`.codex/agent-workflow.json` is versioned, repository-scoped, and secret-free. It defines Project metadata, exact validation, wave-scoped fresh-task execution, managed worktrees, disjoint conflict-key parallelism, single write owner, depth/concurrency limits, heartbeat/stale claims, baseline, gates, and exact-SHA merge policy.

Never store tokens, secrets, device-local Project IDs, canonical task IDs as configuration, or absolute worktree paths. Discover saved-project/task/worktree capability at runtime. `configured: false` fails closed.

## Packet schemas

`.codex/schemas/v2/` contains:

- Canonical Brief, Global Roadmap, Phase Plan, and Design Readiness;
- Orchestrator Start and Plan Materialization Report;
- Orchestrator State/Handoff and Wave Completion;
- Worker and Surface Update;
- Finding and Human Action Required;
- Pre-PR Admission and Worker Completion;
- Merge Authorization and Phase Exit.

Task/worktree IDs may appear in GitHub evidence; absolute local filesystem paths may not. Packets use `schema_version: 2` and a fixed `packet_type`.

## Truth and identity

Use `observed`, `inferred`, `planned`, and `unknown`. A write becomes observed only after a canonical ID/URL/result and read-after-write. A queued client ID remains `CREATING`; launch requires matching canonical task and managed-worktree identifiers/state.

Independent Worker, reviewer, QA, admission, and high-risk sources have distinct task/human IDs and exact SHA evidence. Admission preserves separate QA and deterministic-gate tracked-tree evidence. Merge authorization binds repository, PR, head/base SHA, and an immutable admission report digest. Post-merge PASS binds merge readback and CI to the resulting merge commit. Agent prose, role labels, tool descriptions, and copied PASS strings are not external evidence. Unknown required facts fail closed.

## Compatibility

Skill names `github-agent-orchestrator` and `github-agent-worker` stay stable. Status migration maps `Intake → Backlog`; compatible data remains. Personal repositories use Work Type; organization Issue Types and merge queue are optional after verification.
