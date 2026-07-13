---
title: Worker and TDD
description: One-Issue delivery, owner-layer research, Finding Packets, and completion evidence.
order: 7
slug: worker-tdd
---

# Worker and TDD

A Worker owns exactly one Ready leaf Issue, one `agent/<issue>-<slug>` branch, and one PR. Isolation does not authorize scope expansion.

## Delivery loop

1. Verify Ready status, leaf/size/dependencies, claim, packet, branch, and validation contract.
2. Trace vertically from user/caller to the owner layer and horizontally across sibling contracts, states, tests, and docs.
3. Reproduce the missing behavior and add the highest-value failing test the repository supports.
4. Capture RED, implement the smallest coherent owner-layer change, capture GREEN, then refactor.
5. Run targeted checks, full configured validation, and the primary user/runtime signal.
6. Push current HEAD for branch CI and request independent review/QA plus conditional design/security.
7. Assemble admission evidence. Do not create a PR until it passes for that SHA.

Docs/config work may use an exemption only when runtime behavior is unchanged. Record the exemption type and reason before editing.

## Scope discoveries

Return an out-of-scope defect as a Finding Packet with reproduction, severity, affected acceptance criterion, SHA, risk flags, and evidence. Continue only after Orchestrator classifies it as in-scope. Never silently bundle an independent fix or directly create a Bug.

## Validation truth

The primary signal is observable behavior or runtime state. Tests, lint, typecheck, build, and logs are secondary unless the Issue explicitly defines one as the contract. A green proxy cannot override a broken primary signal.

After every new commit, prior reviewer, QA, branch CI, and admission evidence is stale. Re-run the required surfaces. A Worker posts Worker Completion Report v2 only after the PR exists, admission is current, and the primary signal is met. Blocked or partially validated work uses Finding/Human Action evidence and is not mislabeled complete. Merge remains human-owned.

Evidence cannot be self-certified. Each reviewer/QA result identifies a distinct task/thread/agent or named human, exact SHA, steps, and an inspectable result. A Worker must report a missing tool, inaccessible CI run, or unverifiable primary signal as `unknown`, `FAIL`, or `partially validated`; it must not replace missing evidence with plausible prose.
