---
title: Human Gates
description: Revision-bound approvals, exact-SHA merge authorization, and actionable escalation.
order: 9
slug: human-gates
---

# Human gates

Humans approve the Canonical Brief revision, global roadmap/Phase Plan revision, wave/phase entry and exit, high-risk/security/auth/data/migration/legal/billing/destructive/product decisions, deploy/release, and every exact PR/head SHA merge.

Low/Medium XS–M leaves inside an approved wave run autonomously when the contract is complete. Human approval does not broaden tool permissions or product scope.

## Merge ownership

Automatic Low-risk merge is disabled. Human reviews the exact repository, PR, head SHA, current base SHA, and immutable admission report digest, then publishes a Merge Authorization Packet. Orchestrator—not the Worker—re-reads SHA/base/checks/dependencies/threads/admission, merges with `expected_head_sha`, verifies merge, and waits for post-merge CI. Any head/base/admission change cancels authorization.

Several PRs may be authorized together only when every PR and exact SHA is listed and conflict keys are disjoint.

## Merge Authorization prompt — EN

```text
Authorize Orchestrator to merge only the following reviewed PR/head SHA pair after fresh readback:
Repository: <owner/repo>
PR: <number and URL>
Exact head SHA: <40-char SHA>
Exact base SHA: <40-char SHA>
Admission report: <URL and 64-char digest>
Human identity: <identity>
Valid until: <timestamp>
If head/base SHA, required checks, dependencies, review threads, or admission changed, do not merge; return Human Action Required. After merge, require merge readback and post-merge CI before Done/archive.
```

## Промпт Merge Authorization — RU

```text
Разрешаю Orchestrator выполнить merge только для следующей проверенной пары PR/head SHA после свежего readback:
Репозиторий: <owner/repo>
PR: <номер и URL>
Точный head SHA: <40-символьный SHA>
Точный base SHA: <40-символьный SHA>
Admission report: <URL и 64-символьный digest>
Human identity: <identity>
Действительно до: <timestamp>
Если изменились head/base SHA, required checks, dependencies, review threads или admission, не выполняй merge; верни Human Action Required. После merge требуй merge readback и post-merge CI до Done/archive.
```

## Human Action Required

An escalation names the blocked state, evidence, one decision, up to two safe options, and an observable resume condition. Do not ask a human to solve an uninvestigated technical problem.

Silence, heartbeat, green test, agent comment, or approval for a different revision/SHA is not approval. Record identity, exact revision/PR/SHA, timestamp, decision, and residual risk.
