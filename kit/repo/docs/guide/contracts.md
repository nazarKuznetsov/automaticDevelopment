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

`.codex/agent-workflow.json` is versioned, repository-scoped, and secret-free. It defines Project metadata, exact validation, `solo_fast|team_safe|regulated`, `route_to_source|block_and_report`, wave execution, managed worktrees, conflict-key parallelism, baseline, gates, and merge policy.

`.codex/kit-lock.json` schema v3 is the source/target provenance contract. `kit.source_repository` and exact `source_commit` identify managed ownership; `target.repository`, origin, and default branch identify installation/execution. Neither identity may be inferred from documentation, directory names, or task history.

Optional `bootstrap` and `canonical_publication` blocks bind narrow no-Issue admission to exact human-approved targets. Leave them `null` unless active, use values read from authoritative repository/task state, and retire them after use. Repository facts and operational readback are explained in the host-owned `docs/project-workflow-runbook.md`; managed guide files never contain project values.

Never store tokens, secrets, device-local Project IDs, canonical task IDs as configuration, or absolute worktree paths. Discover saved-project/task/worktree capability at runtime. `configured: false` fails closed.

## Packet schemas

`.codex/schemas/v2/` contains:

- Canonical Brief, Global Roadmap, Phase Plan, and Design Readiness;
- Orchestrator Start and Plan Materialization Report;
- Wave Authority Lease and Kit Maintenance;
- Orchestrator State/Handoff and Wave Completion;
- Worker and Surface Update;
- Finding and Human Action Required;
- Pre-PR Admission and Worker Completion;
- Merge Authorization and Phase Exit.

Task/worktree IDs may appear in GitHub evidence; absolute local filesystem paths may not. Packets use `schema_version: 2` and a fixed `packet_type`.

Pre-PR Admission uses exactly one subject pair: Worker/Issue, executor/bootstrap, or publisher/Canonical publication. The latter two do not grant product scope, Issue materialization, or merge authority. Mixed subject fields, unconfigured targets, changed config, unknown raw fields, stale base, or content outside an approved Canonical publication path/hash set fail closed.

Global Roadmap and Phase Plan are indivisible machine contracts, not prose templates. Every materializable item has an exact title and complete Project metadata; every dependency has typed `blocking`/`blocked` IDs; the Phase Plan selects its durable report parent. Both packets carry deterministic content digests, and human approval binds exact revisions/digests plus a named identity. The Orchestrator must recompute and validate both before writes.

The Start Packet binds one execution repository and one Wave Authority Lease. `materialization_only` covers the current horizon with zero Worker authority. `wave_execution` covers one to five Ready leaves. The durable report binds the same exact repository, a stable run ID, complete operation journal, completed/remaining IDs, and resume state. Operation IDs are recomputed from repository/kind/key/target; completed/remaining sets may reference only that journal and must partition its pending writes. Retry changes neither approved product scope nor authority.

Worker Packet repository identity must match config, remote, packet, and Issue. The manifest is authoritative for Kit-listed paths. A non-manifest product path is `host` only when the target surface explicitly declares it; generator evidence declares `generated`; everything else is `unknown` and blocks. A host claim cannot override manifest ownership. Target repositories never carry managed overlays.

The Kit Maintenance Packet preserves mixed-scope target adoption paths separately from managed paths. Its readback-driven state sequence deduplicates source Issues/PRs, installs the exact merged source SHA, runs target regression against that SHA, and only then resumes the original journal.

## Truth and identity

Use `observed`, `inferred`, `planned`, and `unknown`. A write becomes observed only after a canonical ID/URL/result and read-after-write. A queued client ID remains `CREATING`; launch requires matching canonical task and managed-worktree identifiers/state.

Independent Worker, reviewer, QA, admission, and high-risk sources have distinct task/human IDs and exact SHA evidence. Admission preserves separate QA and deterministic-gate tracked-tree evidence. Merge authorization binds repository, PR, head/base SHA, and an immutable admission report digest. Post-merge PASS binds merge readback and CI to the resulting merge commit. Agent prose, role labels, tool descriptions, and copied PASS strings are not external evidence. Unknown required facts fail closed.

## Compatibility

Skill names and workflow schema v2 stay stable. Installer reads lock v2 and writes provenance-bound lock v3. Status migration maps `Intake → Backlog`; advanced current states are preserved. Personal repositories use Work Type; organization capabilities remain optional after verification.
