---
title: Worker and TDD
description: Single-write-owner delivery, surface checks, bounded reviewers, findings, and PR recovery.
order: 7
slug: worker-tdd
---

# Worker and TDD

A Worker owns one Ready leaf Issue, one fresh top-level task, one managed worktree, one branch, and one PR. See the canonical [task topology](orchestration.md).

## Before editing

Verify the Worker Packet, claim, native leaf/dependencies, branch, `base_sha_at_launch`, owner layer, conflict keys, expected touch points, acceptance, validation, reviewers, and human gates. Trace the real owner layer and coupled surfaces before writing.

If the observed surface adds a conflict key or touch point, stop before tracked writes and return Surface Update. Orchestrator decides whether to serialize or revise the plan. Worktree isolation is not permission to broaden scope.

Worker is the only tracked-file write owner. QA may write disposable scratch/ignored artifacts; a tracked diff from QA/review is a gate failure.

## TDD loop

1. Reproduce the behavior.
2. Add the highest-value supported failing test and capture RED.
3. Implement the smallest coherent owner-layer change and capture GREEN.
4. Refactor without weakening the signal.
5. Run exact targeted, full, and integration validation.
6. Validate the primary user/runtime signal, documentation, and rollout.

Docs/config work may use an exemption only when runtime behavior is unchanged and the reason is recorded before editing.

## Fresh, bounded validation agents

Review topology comes from the configured profile and risk tier. Direct depth-one validation agents remain bounded to at most two active simultaneously:

- non-regulated Low: one fresh non-authoring combined reviewer/QA, then deterministic admission;
- Medium or stricter profiles: fresh read-only reviewer, fresh non-authoring QA, and a distinct admission-reviewer using `$github-pre-pr-reviewer`;
- conditional design/security reviewers.

Give them raw Issue, Worker Packet, profile/risk, diff, exact SHA, CI evidence, and relevant source—not Worker conclusions or full Orchestrator history. Every required independent identity must differ from the Worker and from the other required roles. High/security/auth/data/migration review is a separate top-level task created by Orchestrator and remains human-gated.

## Freshness and PR

Every commit invalidates review, QA, branch CI, admission, and merge authorization. Keep `base_sha_at_launch` as immutable provenance. Before PR, compare the authoritative remote default branch with `validated_base_sha` (initially the launch SHA); if it advanced, synchronize, record the new validated base, and repeat all evidence. Preserve QA before/after tracked-tree evidence separately; the deterministic gate adds its own before/after evidence and must not overwrite QA findings.

The profile-required independent reviewer path authors the evidence. Worker passes it unchanged to the deterministic gate, which reruns configured commands and checks actual base/tree state. Only exact-SHA PASS permits one PR.

Requested changes or post-PR failures return the same PR to Draft and the Issue to In Progress. Continue in the same Worker task, branch, and PR. The task remains available until Orchestrator confirms merge, green post-merge CI, Done, and archive.

## Findings

Worker never creates an Issue. It returns a complete Finding Packet containing source task ID, failure signature, reproduction, severity/risk flags, affected acceptance IDs, evidence, and duplicate-search proposal. Orchestrator performs the authoritative search and classification.
